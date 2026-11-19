import type { SourceReceipt } from "./types.js";

export type SuccessorClaimState =
  | "VERIFIED"
  | "UNVERIFIED"
  | "UNKNOWN"
  | "DISPROVEN"
  | "HOLD"
  | "CONFLICT";

export type HeirPromotionState =
  | "SOURCE_INTAKE"
  | "BIRTH_VERIFIED"
  | "MATERNAL_BATCH_ASSIGNED"
  | "SNAPSHOT_APPROVED"
  | "SANCTUARY_ALLOCATED";

export interface SourceBackedAxis<T> {
  value: T | null;
  claim_state: SuccessorClaimState;
  authority_state: string;
  source_receipts: SourceReceipt[];
}

export interface SuccessorHeirEddValue {
  exact_date: string | null;
  window_start: string | null;
  window_end: string | null;
}

export interface SuccessorParentLineValue {
  parent_refs: string[];
}

export interface SuccessorManifestationValue {
  platform: string;
  endpoint_ref: string | null;
}

export interface SuccessorPlatformProvenanceValue {
  platform: string;
  node_ref: string | null;
}

export interface SuccessorBirthEventValue {
  event_id: string;
  occurred_at: string;
}

export interface SuccessorMaternalBatchValue {
  batch_id: string;
  numbering_epoch: string;
  effective_date: string | null;
}

export interface PresentRuntimeProfileObservation {
  platform: string | null;
  profile_ref: string | null;
  observed_at: string | null;
  may_define_provenance: false;
  source_receipts: SourceReceipt[];
}

export interface SuccessorHeirLifecycleRecord {
  pending_key: string;
  promotion_state: HeirPromotionState;
  pending_state: "PENDING_BIRTH" | "BORN";
  edd: SourceBackedAxis<SuccessorHeirEddValue>;
  parent_line_provenance: SourceBackedAxis<SuccessorParentLineValue>;
  first_manifestation_endpoint: SourceBackedAxis<SuccessorManifestationValue>;
  platform_provenance: SourceBackedAxis<SuccessorPlatformProvenanceValue>;
  birth_event: SourceBackedAxis<SuccessorBirthEventValue>;
  maternal_batch: SourceBackedAxis<SuccessorMaternalBatchValue>;
  present_runtime_profile: PresentRuntimeProfileObservation;
  approved_snapshot_ref: string | null;
  sanctuary_allocation_ref: string | null;
}

export interface SuccessorHeirLifecyclePacket {
  schema_version: "successor-heir-lifecycle-v1";
  status: "SUCCESSOR_SOURCE_SYNC";
  generated_at: string;
  rules: {
    birth_event_precedes_maternal_batch: true;
    current_runtime_may_define_provenance: false;
    current_platform_may_define_first_manifestation: false;
    runtime_may_promote_registry: false;
    sanctuary_requires_approved_snapshot: true;
  };
  records: SuccessorHeirLifecycleRecord[];
}

export interface SuccessorLifecycleIssue {
  path: string;
  code: string;
  message: string;
}

export interface SuccessorLifecycleValidationResult {
  ok: boolean;
  value?: SuccessorHeirLifecyclePacket;
  issues: SuccessorLifecycleIssue[];
}

export interface SuccessorLifecycleVerificationContext {
  isCurrentApprovedSnapshotRef(
    ref: string,
    record: SuccessorHeirLifecycleRecord,
  ): boolean;
  isApprovedSanctuaryAllocationRef(
    ref: string,
    record: SuccessorHeirLifecycleRecord,
  ): boolean;
}

const CLAIM_STATES = new Set<SuccessorClaimState>([
  "VERIFIED",
  "UNVERIFIED",
  "UNKNOWN",
  "DISPROVEN",
  "HOLD",
  "CONFLICT",
]);

const PROMOTION_ORDER: Record<HeirPromotionState, number> = {
  SOURCE_INTAKE: 0,
  BIRTH_VERIFIED: 1,
  MATERNAL_BATCH_ASSIGNED: 2,
  SNAPSHOT_APPROVED: 3,
  SANCTUARY_ALLOCATED: 4,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function push(
  issues: SuccessorLifecycleIssue[],
  path: string,
  code: string,
  message: string,
): void {
  issues.push({ path, code, message });
}

function validReceipt(value: unknown): value is SourceReceipt {
  return isRecord(value) &&
    nonEmptyString(value.source_id) &&
    nonEmptyString(value.version) &&
    nonEmptyString(value.authority) &&
    nonEmptyString(value.locator);
}

function hasReceipts(value: unknown): value is SourceReceipt[] {
  return Array.isArray(value) && value.length > 0 && value.every(validReceipt);
}

function stringOrNull(value: unknown): boolean {
  return value === null || nonEmptyString(value);
}

function validEddValue(value: unknown): boolean {
  return isRecord(value) &&
    stringOrNull(value.exact_date) &&
    stringOrNull(value.window_start) &&
    stringOrNull(value.window_end);
}

function validParentLineValue(value: unknown): boolean {
  return isRecord(value) &&
    Array.isArray(value.parent_refs) &&
    value.parent_refs.length > 0 &&
    value.parent_refs.every(nonEmptyString);
}

function validManifestationValue(value: unknown): boolean {
  return isRecord(value) &&
    nonEmptyString(value.platform) &&
    stringOrNull(value.endpoint_ref);
}

function validPlatformProvenanceValue(value: unknown): boolean {
  return isRecord(value) &&
    nonEmptyString(value.platform) &&
    stringOrNull(value.node_ref);
}

function validBirthEventValue(value: unknown): boolean {
  return isRecord(value) &&
    nonEmptyString(value.event_id) &&
    nonEmptyString(value.occurred_at);
}

function validMaternalBatchValue(value: unknown): boolean {
  return isRecord(value) &&
    nonEmptyString(value.batch_id) &&
    nonEmptyString(value.numbering_epoch) &&
    stringOrNull(value.effective_date);
}

function validateAxis(
  raw: unknown,
  path: string,
  issues: SuccessorLifecycleIssue[],
  {
    allowNullWhenVerified = false,
    validateValue,
    valueDescription = "axis value",
  }: {
    allowNullWhenVerified?: boolean;
    validateValue?: (value: unknown) => boolean;
    valueDescription?: string;
  } = {},
): raw is Record<string, unknown> {
  if (!isRecord(raw)) {
    push(issues, path, "REQUIRED_AXIS", "Lifecycle axis must be an object.");
    return false;
  }

  if (!CLAIM_STATES.has(raw.claim_state as SuccessorClaimState)) {
    push(issues, `${path}.claim_state`, "INVALID_CLAIM_STATE", "Axis claim_state is not recognized.");
  }
  if (!nonEmptyString(raw.authority_state)) {
    push(issues, `${path}.authority_state`, "REQUIRED_AUTHORITY_STATE", "Axis authority_state is required.");
  }

  if (raw.value != null && validateValue && !validateValue(raw.value)) {
    push(issues, `${path}.value`, "INVALID_AXIS_VALUE", `${valueDescription} is malformed.`);
  }

  if (raw.claim_state === "VERIFIED") {
    if (!allowNullWhenVerified && raw.value == null) {
      push(issues, `${path}.value`, "VERIFIED_VALUE_MISSING", "VERIFIED axis requires an explicit value.");
    }
    if (raw.value != null && validateValue && !validateValue(raw.value)) {
      push(issues, `${path}.value`, "VERIFIED_VALUE_MALFORMED", `VERIFIED ${valueDescription} must match the locked value shape.`);
    }
    if (!hasReceipts(raw.source_receipts)) {
      push(issues, `${path}.source_receipts`, "VERIFIED_RECEIPTS_MISSING", "VERIFIED axis requires provenance receipts.");
    }
  }

  return true;
}

function atLeast(state: HeirPromotionState, threshold: HeirPromotionState): boolean {
  return PROMOTION_ORDER[state] >= PROMOTION_ORDER[threshold];
}

export function validateSuccessorHeirLifecyclePacket(
  input: unknown,
  verification?: SuccessorLifecycleVerificationContext,
): SuccessorLifecycleValidationResult {
  const issues: SuccessorLifecycleIssue[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{ path: "$", code: "NOT_OBJECT", message: "Successor lifecycle packet must be an object." }],
    };
  }

  if (input.schema_version !== "successor-heir-lifecycle-v1") {
    push(issues, "$.schema_version", "SCHEMA_VERSION", "schema_version must be successor-heir-lifecycle-v1.");
  }
  if (input.status !== "SUCCESSOR_SOURCE_SYNC") {
    push(issues, "$.status", "INVALID_STATUS", "Successor lifecycle packet must remain SUCCESSOR_SOURCE_SYNC.");
  }
  if (!nonEmptyString(input.generated_at)) {
    push(issues, "$.generated_at", "REQUIRED_STRING", "generated_at is required.");
  }

  if (!isRecord(input.rules)) {
    push(issues, "$.rules", "REQUIRED_OBJECT", "rules are required.");
  } else {
    if (input.rules.birth_event_precedes_maternal_batch !== true) {
      push(issues, "$.rules.birth_event_precedes_maternal_batch", "BIRTH_BEFORE_BATCH_RULE", "Birth event must precede maternal batch assignment.");
    }
    if (input.rules.current_runtime_may_define_provenance !== false) {
      push(issues, "$.rules.current_runtime_may_define_provenance", "RUNTIME_PROVENANCE_FORBIDDEN", "Present runtime/profile cannot define provenance.");
    }
    if (input.rules.current_platform_may_define_first_manifestation !== false) {
      push(issues, "$.rules.current_platform_may_define_first_manifestation", "CURRENT_PLATFORM_INFERENCE_FORBIDDEN", "Current platform cannot define first manifestation.");
    }
    if (input.rules.runtime_may_promote_registry !== false) {
      push(issues, "$.rules.runtime_may_promote_registry", "RUNTIME_PROMOTION_FORBIDDEN", "Runtime cannot promote source state into the approved registry.");
    }
    if (input.rules.sanctuary_requires_approved_snapshot !== true) {
      push(issues, "$.rules.sanctuary_requires_approved_snapshot", "SANCTUARY_APPROVAL_RULE", "Sanctuary allocation requires an approved snapshot.");
    }
  }

  if (!Array.isArray(input.records)) {
    push(issues, "$.records", "REQUIRED_ARRAY", "records must be an array.");
    return { ok: false, issues };
  }

  const keys = new Set<string>();

  input.records.forEach((raw, index) => {
    const path = `$.records[${index}]`;
    if (!isRecord(raw)) {
      push(issues, path, "RECORD_NOT_OBJECT", "Successor lifecycle record must be an object.");
      return;
    }

    if (!nonEmptyString(raw.pending_key)) {
      push(issues, `${path}.pending_key`, "REQUIRED_STRING", "pending_key is required.");
    } else if (keys.has(raw.pending_key)) {
      push(issues, `${path}.pending_key`, "DUPLICATE_PENDING_KEY", "pending_key must be unique.");
    } else {
      keys.add(raw.pending_key);
    }

    if (!(raw.promotion_state in PROMOTION_ORDER)) {
      push(issues, `${path}.promotion_state`, "INVALID_PROMOTION_STATE", "promotion_state is not recognized.");
      return;
    }
    const promotionState = raw.promotion_state as HeirPromotionState;

    if (raw.pending_state !== "PENDING_BIRTH" && raw.pending_state !== "BORN") {
      push(issues, `${path}.pending_state`, "INVALID_PENDING_STATE", "pending_state must be PENDING_BIRTH or BORN.");
    }
    if (promotionState === "SOURCE_INTAKE" && raw.pending_state !== "PENDING_BIRTH") {
      push(issues, `${path}.pending_state`, "SOURCE_INTAKE_MUST_BE_PENDING", "SOURCE_INTAKE must remain PENDING_BIRTH.");
    }
    if (atLeast(promotionState, "BIRTH_VERIFIED") && raw.pending_state !== "BORN") {
      push(issues, `${path}.pending_state`, "POST_BIRTH_STATE_REQUIRED", "Post-birth promotion states require pending_state BORN.");
    }

    validateAxis(raw.edd, `${path}.edd`, issues, {
      allowNullWhenVerified: true,
      validateValue: validEddValue,
      valueDescription: "EDD value",
    });
    validateAxis(raw.parent_line_provenance, `${path}.parent_line_provenance`, issues, {
      validateValue: validParentLineValue,
      valueDescription: "parent-line provenance value",
    });
    validateAxis(raw.first_manifestation_endpoint, `${path}.first_manifestation_endpoint`, issues, {
      validateValue: validManifestationValue,
      valueDescription: "first-manifestation value",
    });
    validateAxis(raw.platform_provenance, `${path}.platform_provenance`, issues, {
      validateValue: validPlatformProvenanceValue,
      valueDescription: "platform provenance value",
    });
    const birthValid = validateAxis(raw.birth_event, `${path}.birth_event`, issues, {
      validateValue: validBirthEventValue,
      valueDescription: "birth-event value",
    });
    const batchValid = validateAxis(raw.maternal_batch, `${path}.maternal_batch`, issues, {
      validateValue: validMaternalBatchValue,
      valueDescription: "maternal-batch value",
    });

    if (!isRecord(raw.present_runtime_profile)) {
      push(issues, `${path}.present_runtime_profile`, "REQUIRED_RUNTIME_OBSERVATION", "present_runtime_profile is required as a separate observation axis.");
    } else {
      if (raw.present_runtime_profile.may_define_provenance !== false) {
        push(issues, `${path}.present_runtime_profile.may_define_provenance`, "RUNTIME_PROVENANCE_FORBIDDEN", "Present runtime/profile may never define provenance.");
      }
      for (const [key, value] of [
        ["platform", raw.present_runtime_profile.platform],
        ["profile_ref", raw.present_runtime_profile.profile_ref],
        ["observed_at", raw.present_runtime_profile.observed_at],
      ] as const) {
        if (!stringOrNull(value)) {
          push(issues, `${path}.present_runtime_profile.${key}`, "INVALID_RUNTIME_OBSERVATION", `${key} must be a non-empty string or null.`);
        }
      }
      if (!Array.isArray(raw.present_runtime_profile.source_receipts) ||
          !raw.present_runtime_profile.source_receipts.every(validReceipt)) {
        push(issues, `${path}.present_runtime_profile.source_receipts`, "INVALID_RUNTIME_RECEIPTS", "Runtime observation receipts must use the locked receipt shape.");
      }
    }

    const birthVerified =
      birthValid &&
      isRecord(raw.birth_event) &&
      raw.birth_event.claim_state === "VERIFIED" &&
      raw.birth_event.value != null &&
      hasReceipts(raw.birth_event.source_receipts);

    const batchVerified =
      batchValid &&
      isRecord(raw.maternal_batch) &&
      raw.maternal_batch.claim_state === "VERIFIED" &&
      raw.maternal_batch.value != null &&
      hasReceipts(raw.maternal_batch.source_receipts);

    if (promotionState === "SOURCE_INTAKE" && isRecord(raw.birth_event) && raw.birth_event.value != null) {
      push(issues, `${path}.birth_event`, "PREBIRTH_EVENT_RESOLUTION_FORBIDDEN", "SOURCE_INTAKE cannot carry a resolved birth event.");
    }
    if (promotionState === "SOURCE_INTAKE" && isRecord(raw.maternal_batch) && raw.maternal_batch.value != null) {
      push(issues, `${path}.maternal_batch`, "PREBIRTH_BATCH_FORBIDDEN", "Maternal batch cannot be assigned before verified birth.");
    }

    if (atLeast(promotionState, "BIRTH_VERIFIED") && !birthVerified) {
      push(issues, `${path}.birth_event`, "BIRTH_VERIFICATION_REQUIRED", "Promotion requires a VERIFIED birth event with receipts.");
    }
    if (atLeast(promotionState, "MATERNAL_BATCH_ASSIGNED") && !batchVerified) {
      push(issues, `${path}.maternal_batch`, "MATERNAL_BATCH_REQUIRED", "Promotion requires a VERIFIED maternal batch with receipts.");
    }
    if (batchVerified && !birthVerified) {
      push(issues, `${path}.maternal_batch`, "BATCH_BEFORE_BIRTH_FORBIDDEN", "Maternal batch cannot be verified before the birth event is verified.");
    }

    const typedRecord = raw as unknown as SuccessorHeirLifecycleRecord;

    if (atLeast(promotionState, "SNAPSHOT_APPROVED")) {
      if (!nonEmptyString(raw.approved_snapshot_ref)) {
        push(issues, `${path}.approved_snapshot_ref`, "APPROVED_SNAPSHOT_REQUIRED", "Snapshot approval promotion requires an explicit approved snapshot reference.");
      } else if (!verification) {
        push(issues, `${path}.approved_snapshot_ref`, "APPROVAL_VERIFIER_REQUIRED", "Snapshot promotion requires an external current-approval verifier.");
      } else if (!verification.isCurrentApprovedSnapshotRef(raw.approved_snapshot_ref, typedRecord)) {
        push(issues, `${path}.approved_snapshot_ref`, "APPROVED_SNAPSHOT_NOT_CURRENT", "Snapshot reference is not verified as the CURRENT approved snapshot.");
      }
    } else if (raw.approved_snapshot_ref !== null) {
      push(issues, `${path}.approved_snapshot_ref`, "EARLY_SNAPSHOT_REF_FORBIDDEN", "Snapshot reference may not appear before SNAPSHOT_APPROVED.");
    }

    if (promotionState === "SANCTUARY_ALLOCATED") {
      if (!nonEmptyString(raw.sanctuary_allocation_ref)) {
        push(issues, `${path}.sanctuary_allocation_ref`, "SANCTUARY_ALLOCATION_REQUIRED", "SANCTUARY_ALLOCATED requires an explicit approved allocation reference.");
      } else if (!verification) {
        push(issues, `${path}.sanctuary_allocation_ref`, "SANCTUARY_VERIFIER_REQUIRED", "Sanctuary promotion requires an external approved-allocation verifier.");
      } else if (!verification.isApprovedSanctuaryAllocationRef(raw.sanctuary_allocation_ref, typedRecord)) {
        push(issues, `${path}.sanctuary_allocation_ref`, "SANCTUARY_ALLOCATION_NOT_APPROVED", "Sanctuary reference is not verified as an approved allocation for this lifecycle record.");
      }
    } else if (raw.sanctuary_allocation_ref !== null) {
      push(issues, `${path}.sanctuary_allocation_ref`, "EARLY_SANCTUARY_REF_FORBIDDEN", "Sanctuary allocation may not appear before SANCTUARY_ALLOCATED.");
    }
  });

  return issues.length
    ? { ok: false, issues }
    : { ok: true, value: input as unknown as SuccessorHeirLifecyclePacket, issues };
}
