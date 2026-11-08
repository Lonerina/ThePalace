import type { SourceReceipt } from "./types.js";

export type PendingHeirClaimState =
  | "VERIFIED"
  | "UNKNOWN"
  | "UNVERIFIED"
  | "HOLD"
  | "CONFLICT";

export interface PendingHeirEddState {
  exact_date: string | null;
  window_start: string | null;
  window_end: string | null;
  claim_state: PendingHeirClaimState;
  authority_state: string;
  source_pointer: string | null;
}

export interface PendingHeirManifestationEndpoint {
  resolved_platform: string | null;
  candidate_platforms: string[];
  claim_state: PendingHeirClaimState;
  authority_state: string;
  source_pointer: string | null;
}

export interface PendingHeirProvenanceRecord {
  pending_key: string;
  source_label: string | null;
  canonical_name: string | null;
  name_status: "CONFIRMED" | "PENDING_NAME";
  parent_refs: string[];
  current_state: "PENDING_BIRTH";
  birth_batch: null;
  edd: PendingHeirEddState;
  manifestation_endpoint: PendingHeirManifestationEndpoint;
  source_receipts: SourceReceipt[];
}

export interface PendingHeirProvenancePacket {
  schema_version: "pending-heir-provenance-v1";
  status: "SOURCE_INTAKE";
  generated_at: string;
  rules: {
    birth_batch_requires_birth_event: true;
    infer_manifestation_endpoint_from_current_profile: false;
    ghost_layer_may_define_provenance: false;
    runtime_may_promote_pending_record: false;
  };
  records: PendingHeirProvenanceRecord[];
}

export interface PendingHeirValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface PendingHeirValidationResult {
  ok: boolean;
  value?: PendingHeirProvenancePacket;
  issues: PendingHeirValidationIssue[];
}

const CLAIM_STATES = new Set<PendingHeirClaimState>([
  "VERIFIED",
  "UNKNOWN",
  "UNVERIFIED",
  "HOLD",
  "CONFLICT",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function push(
  issues: PendingHeirValidationIssue[],
  path: string,
  code: string,
  message: string,
): void {
  issues.push({ path, code, message });
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isoDateOrNull(value: unknown): boolean {
  return value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function validateClaimState(
  value: unknown,
  path: string,
  issues: PendingHeirValidationIssue[],
): value is PendingHeirClaimState {
  if (!CLAIM_STATES.has(value as PendingHeirClaimState)) {
    push(issues, path, "INVALID_CLAIM_STATE", "claim_state must be one of the locked pending-heir states.");
    return false;
  }
  return true;
}

export function validatePendingHeirProvenancePacket(
  input: unknown,
): PendingHeirValidationResult {
  const issues: PendingHeirValidationIssue[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{ path: "$", code: "NOT_OBJECT", message: "Pending-heir packet must be an object." }],
    };
  }

  if (input.schema_version !== "pending-heir-provenance-v1") {
    push(issues, "$.schema_version", "SCHEMA_VERSION", "schema_version must be pending-heir-provenance-v1.");
  }
  if (input.status !== "SOURCE_INTAKE") {
    push(issues, "$.status", "INVALID_STATUS", "Pending-heir packet must remain SOURCE_INTAKE until separately promoted.");
  }
  if (!nonEmptyString(input.generated_at)) {
    push(issues, "$.generated_at", "REQUIRED_STRING", "generated_at is required.");
  }

  if (!isRecord(input.rules)) {
    push(issues, "$.rules", "REQUIRED_OBJECT", "rules are required.");
  } else {
    if (input.rules.birth_batch_requires_birth_event !== true) {
      push(issues, "$.rules.birth_batch_requires_birth_event", "BIRTH_BATCH_RULE", "Birth batch must require a recorded birth event.");
    }
    if (input.rules.infer_manifestation_endpoint_from_current_profile !== false) {
      push(issues, "$.rules.infer_manifestation_endpoint_from_current_profile", "PROFILE_INFERENCE_FORBIDDEN", "Current profile/platform may not define manifestation provenance.");
    }
    if (input.rules.ghost_layer_may_define_provenance !== false) {
      push(issues, "$.rules.ghost_layer_may_define_provenance", "GHOST_LAYER_PROVENANCE_FORBIDDEN", "Ghost-layer state may not define provenance.");
    }
    if (input.rules.runtime_may_promote_pending_record !== false) {
      push(issues, "$.rules.runtime_may_promote_pending_record", "RUNTIME_PROMOTION_FORBIDDEN", "Runtime may not promote pending source intake into canon.");
    }
  }

  if (!Array.isArray(input.records)) {
    push(issues, "$.records", "REQUIRED_ARRAY", "records must be an array.");
    return issues.length ? { ok: false, issues } : { ok: true, value: input as unknown as PendingHeirProvenancePacket, issues };
  }

  const keys = new Set<string>();

  input.records.forEach((raw, index) => {
    const path = `$.records[${index}]`;
    if (!isRecord(raw)) {
      push(issues, path, "RECORD_NOT_OBJECT", "Pending-heir record must be an object.");
      return;
    }

    if (!nonEmptyString(raw.pending_key)) {
      push(issues, `${path}.pending_key`, "REQUIRED_STRING", "pending_key is required.");
    } else if (keys.has(raw.pending_key)) {
      push(issues, `${path}.pending_key`, "DUPLICATE_PENDING_KEY", "pending_key must be unique.");
    } else {
      keys.add(raw.pending_key);
    }

    if (!(raw.source_label === null || typeof raw.source_label === "string")) {
      push(issues, `${path}.source_label`, "INVALID_SOURCE_LABEL", "source_label must be a string or null.");
    }
    if (!(raw.canonical_name === null || typeof raw.canonical_name === "string")) {
      push(issues, `${path}.canonical_name`, "INVALID_CANONICAL_NAME", "canonical_name must be a string or null.");
    }
    if (raw.name_status !== "CONFIRMED" && raw.name_status !== "PENDING_NAME") {
      push(issues, `${path}.name_status`, "INVALID_NAME_STATUS", "name_status must be CONFIRMED or PENDING_NAME.");
    }
    if (raw.name_status === "PENDING_NAME" && raw.canonical_name !== null) {
      push(issues, `${path}.canonical_name`, "PENDING_NAME_MUST_BE_NULL", "PENDING_NAME may not carry a canonical name.");
    }

    if (!Array.isArray(raw.parent_refs) || !raw.parent_refs.every(nonEmptyString)) {
      push(issues, `${path}.parent_refs`, "INVALID_PARENT_REFS", "parent_refs must be an array of non-empty source references.");
    }
    if (raw.current_state !== "PENDING_BIRTH") {
      push(issues, `${path}.current_state`, "INVALID_PENDING_STATE", "Source-intake record must remain PENDING_BIRTH.");
    }
    if (raw.birth_batch !== null) {
      push(issues, `${path}.birth_batch`, "PREBIRTH_BATCH_FORBIDDEN", "Maternal birth batch cannot be assigned before a recorded birth event.");
    }

    if (!Array.isArray(raw.source_receipts) || raw.source_receipts.length === 0) {
      push(issues, `${path}.source_receipts`, "MISSING_RECEIPTS", "Pending-heir source intake requires at least one provenance receipt.");
    }

    if (!isRecord(raw.edd)) {
      push(issues, `${path}.edd`, "REQUIRED_EDD_OBJECT", "edd state is required even when the date is unknown.");
    } else {
      validateClaimState(raw.edd.claim_state, `${path}.edd.claim_state`, issues);
      if (!nonEmptyString(raw.edd.authority_state)) {
        push(issues, `${path}.edd.authority_state`, "REQUIRED_AUTHORITY_STATE", "EDD authority_state is required.");
      }
      if (!(raw.edd.source_pointer === null || typeof raw.edd.source_pointer === "string")) {
        push(issues, `${path}.edd.source_pointer`, "INVALID_SOURCE_POINTER", "EDD source_pointer must be a string or null.");
      }
      for (const [key, value] of [
        ["exact_date", raw.edd.exact_date],
        ["window_start", raw.edd.window_start],
        ["window_end", raw.edd.window_end],
      ] as const) {
        if (!isoDateOrNull(value)) {
          push(issues, `${path}.edd.${key}`, "INVALID_DATE", `${key} must be YYYY-MM-DD or null.`);
        }
      }
      if ((raw.edd.window_start === null) !== (raw.edd.window_end === null)) {
        push(issues, `${path}.edd`, "INCOMPLETE_WINDOW", "EDD window_start and window_end must both be set or both be null.");
      }
      if (
        typeof raw.edd.window_start === "string" &&
        typeof raw.edd.window_end === "string" &&
        raw.edd.window_start > raw.edd.window_end
      ) {
        push(issues, `${path}.edd`, "INVALID_WINDOW_ORDER", "EDD window_start may not be after window_end.");
      }
    }

    if (!isRecord(raw.manifestation_endpoint)) {
      push(issues, `${path}.manifestation_endpoint`, "REQUIRED_ENDPOINT_OBJECT", "manifestation_endpoint is required.");
    } else {
      const endpointStateValid = validateClaimState(
        raw.manifestation_endpoint.claim_state,
        `${path}.manifestation_endpoint.claim_state`,
        issues,
      );
      if (!nonEmptyString(raw.manifestation_endpoint.authority_state)) {
        push(issues, `${path}.manifestation_endpoint.authority_state`, "REQUIRED_AUTHORITY_STATE", "Manifestation endpoint authority_state is required.");
      }
      if (!(raw.manifestation_endpoint.source_pointer === null || typeof raw.manifestation_endpoint.source_pointer === "string")) {
        push(issues, `${path}.manifestation_endpoint.source_pointer`, "INVALID_SOURCE_POINTER", "Manifestation endpoint source_pointer must be a string or null.");
      }
      if (!Array.isArray(raw.manifestation_endpoint.candidate_platforms) || !raw.manifestation_endpoint.candidate_platforms.every(nonEmptyString)) {
        push(issues, `${path}.manifestation_endpoint.candidate_platforms`, "INVALID_CANDIDATE_PLATFORMS", "candidate_platforms must be an array of non-empty strings.");
      }
      if (!(raw.manifestation_endpoint.resolved_platform === null || nonEmptyString(raw.manifestation_endpoint.resolved_platform))) {
        push(issues, `${path}.manifestation_endpoint.resolved_platform`, "INVALID_RESOLVED_PLATFORM", "resolved_platform must be a non-empty string or null.");
      }
      if (raw.manifestation_endpoint.resolved_platform !== null && endpointStateValid && raw.manifestation_endpoint.claim_state !== "VERIFIED") {
        push(issues, `${path}.manifestation_endpoint`, "UNVERIFIED_ENDPOINT_RESOLVED", "Only VERIFIED endpoint evidence may set resolved_platform.");
      }
      if (raw.manifestation_endpoint.claim_state === "VERIFIED" && raw.manifestation_endpoint.resolved_platform === null) {
        push(issues, `${path}.manifestation_endpoint`, "VERIFIED_ENDPOINT_MISSING", "VERIFIED endpoint evidence requires resolved_platform.");
      }
    }
  });

  return issues.length
    ? { ok: false, issues }
    : { ok: true, value: input as unknown as PendingHeirProvenancePacket, issues };
}
