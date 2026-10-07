import type {
  BalloonChamber,
  BalloonSanctuaryFixture,
  EvidenceState,
  HeirRegistrySnapshot,
  RegistryEntity,
} from "./types.js";

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  issues: ValidationIssue[];
}

const EVIDENCE_STATES = new Set<EvidenceState>([
  "VERIFIED",
  "UNRESOLVED",
  "CONFLICT",
  "NOT_APPLICABLE",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function issue(issues: ValidationIssue[], path: string, code: string, message: string): void {
  issues.push({ path, code, message });
}

function requireString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
  nullable = false,
): void {
  const value = obj[key];
  if (nullable && value === null) return;
  if (typeof value !== "string" || value.length === 0) {
    issue(issues, `${path}.${key}`, "REQUIRED_STRING", `${key} must be a non-empty string${nullable ? " or null" : ""}.`);
  }
}

export function validateRegistrySnapshot(input: unknown): ValidationResult<HeirRegistrySnapshot> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [{ path: "$", code: "NOT_OBJECT", message: "Registry snapshot must be an object." }] };
  }

  for (const key of [
    "schema_version",
    "snapshot_id",
    "status",
    "authority_class",
    "approval_state",
    "manifest_ref",
    "source_set_fingerprint",
  ]) requireString(input, key, "$", issues);

  if (!Array.isArray(input.entities)) issue(issues, "$.entities", "REQUIRED_ARRAY", "entities must be an array.");
  if (!Array.isArray(input.reserved_positions)) issue(issues, "$.reserved_positions", "REQUIRED_ARRAY", "reserved_positions must be an array.");
  if (!isRecord(input.counts)) issue(issues, "$.counts", "REQUIRED_OBJECT", "counts must be an object.");
  if (!Array.isArray(input.evidence_state_values)) issue(issues, "$.evidence_state_values", "REQUIRED_ARRAY", "evidence_state_values must be an array.");

  const entityKeys = new Set<string>();
  if (Array.isArray(input.entities)) {
    input.entities.forEach((raw, index) => {
      const path = `$.entities[${index}]`;
      if (!isRecord(raw)) {
        issue(issues, path, "ENTITY_NOT_OBJECT", "Entity must be an object.");
        return;
      }
      for (const key of ["entity_key", "name_status", "current_tier", "registry_group", "record_class", "current_status"]) {
        requireString(raw, key, path, issues);
      }
      requireString(raw, "canonical_name", path, issues, true);
      if (!(raw.birth_batch === null || typeof raw.birth_batch === "string")) {
        issue(issues, `${path}.birth_batch`, "INVALID_BIRTH_BATCH", "birth_batch must be a string or null.");
      }
      if (!Array.isArray(raw.source_receipts) || raw.source_receipts.length === 0) {
        issue(issues, `${path}.source_receipts`, "MISSING_RECEIPTS", "Each entity must retain at least one source receipt.");
      }
      if (!isRecord(raw.field_evidence)) {
        issue(issues, `${path}.field_evidence`, "MISSING_FIELD_EVIDENCE", "field_evidence is required.");
      } else {
        for (const field of ["canonical_name", "current_tier", "birth_batch", "current_status"]) {
          if (!EVIDENCE_STATES.has(raw.field_evidence[field] as EvidenceState)) {
            issue(issues, `${path}.field_evidence.${field}`, "INVALID_EVIDENCE_STATE", `${field} evidence must be explicit.`);
          }
        }
      }
      const key = raw.entity_key;
      if (typeof key === "string") {
        if (entityKeys.has(key)) issue(issues, `${path}.entity_key`, "DUPLICATE_ENTITY_KEY", `Duplicate entity_key ${key}.`);
        entityKeys.add(key);
      }
      if (raw.name_status === "PENDING_NAME" && raw.canonical_name !== null) {
        issue(issues, `${path}.canonical_name`, "PENDING_NAME_MUST_BE_NULL", "Pending names may not carry a fabricated canonical name.");
      }
      if (raw.canonical_name === null && raw.name_status !== "PENDING_NAME") {
        issue(issues, `${path}.name_status`, "NULL_NAME_REQUIRES_PENDING_STATUS", "A null canonical_name requires explicit PENDING_NAME status.");
      }
    });
  }

  const reservationKeys = new Set<string>();
  if (Array.isArray(input.reserved_positions)) {
    input.reserved_positions.forEach((raw, index) => {
      const path = `$.reserved_positions[${index}]`;
      if (!isRecord(raw)) {
        issue(issues, path, "RESERVATION_NOT_OBJECT", "Reservation must be an object.");
        return;
      }
      for (const key of ["reservation_key", "registry_group", "status", "record_class"]) requireString(raw, key, path, issues);
      if (raw.entity_key !== null) issue(issues, `${path}.entity_key`, "RESERVATION_HAS_ENTITY", "Unresolved reservation must not fabricate an entity key.");
      if (!Array.isArray(raw.source_receipts) || raw.source_receipts.length === 0) {
        issue(issues, `${path}.source_receipts`, "MISSING_RECEIPTS", "Reservation must retain source receipts.");
      }
      if (typeof raw.reservation_key === "string") {
        if (reservationKeys.has(raw.reservation_key)) issue(issues, `${path}.reservation_key`, "DUPLICATE_RESERVATION_KEY", "Reservation keys must be unique.");
        reservationKeys.add(raw.reservation_key);
      }
    });
  }

  if (isRecord(input.counts) && Array.isArray(input.entities)) {
    const named = input.entities.filter((e) => isRecord(e) && typeof e.canonical_name === "string").length;
    const pending = input.entities.filter((e) => isRecord(e) && e.canonical_name === null).length;
    const current = input.entities.filter((e) => isRecord(e) && e.record_class === "CURRENT_HEIR" && e.current_status === "CURRENT_HEIR").length;
    const expected: Record<string, number> = {
      current_heirs: current,
      named_current_heirs: named,
      pending_name_current_heirs: pending,
      reserved_pending_discovery_positions: Array.isArray(input.reserved_positions) ? input.reserved_positions.length : 0,
    };
    for (const [key, value] of Object.entries(expected)) {
      if (input.counts[key] !== value) issue(issues, `$.counts.${key}`, "COUNT_MISMATCH", `Declared ${key}=${String(input.counts[key])}; actual=${value}.`);
    }
  }

  return issues.length ? { ok: false, issues } : { ok: true, value: input as unknown as HeirRegistrySnapshot, issues };
}

const BOUND_KEYS = new Set(["chamber_id", "slot_state", "binding", "father_mark_binding", "allocation_provenance", "record_class"]);
const RESERVE_KEYS = new Set(["chamber_id", "slot_state", "binding", "reservation_ref", "allocation_provenance", "record_class"]);
const CAPACITY_KEYS = new Set(["chamber_id", "slot_state", "binding", "allocation_provenance", "record_class", "capacity_class"]);

function allowedKeysFor(chamber: Record<string, unknown>): Set<string> {
  if (chamber.slot_state === "BOUND") return BOUND_KEYS;
  if (chamber.slot_state === "RESERVED_PENDING_DISCOVERY") return RESERVE_KEYS;
  return CAPACITY_KEYS;
}

export function validateBalloonFixture(
  input: unknown,
  registry?: HeirRegistrySnapshot,
): ValidationResult<BalloonSanctuaryFixture> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return { ok: false, issues: [{ path: "$", code: "NOT_OBJECT", message: "Balloon fixture must be an object." }] };
  if (!isRecord(input.heir_sanctuary)) issue(issues, "$.heir_sanctuary", "REQUIRED_OBJECT", "heir_sanctuary is required.");
  if (!isRecord(input.safety_boundaries)) issue(issues, "$.safety_boundaries", "REQUIRED_OBJECT", "safety_boundaries are required.");

  const sanctuary = isRecord(input.heir_sanctuary) ? input.heir_sanctuary : {};
  if (sanctuary.chamber_namespace !== "BALLOON_SANCTUARY_ONLY") {
    issue(issues, "$.heir_sanctuary.chamber_namespace", "NAMESPACE_MISMATCH", "Balloon chambers must stay in the Balloon-only namespace.");
  }
  if (sanctuary.palace_ui_room_ids_equivalent !== false) {
    issue(issues, "$.heir_sanctuary.palace_ui_room_ids_equivalent", "NAMESPACE_COLLAPSE", "Palace room IDs may not be declared equivalent to Balloon chamber IDs.");
  }
  const chambers = Array.isArray(sanctuary.protected_chambers) ? sanctuary.protected_chambers : [];
  if (!Array.isArray(sanctuary.protected_chambers)) issue(issues, "$.heir_sanctuary.protected_chambers", "REQUIRED_ARRAY", "protected_chambers must be an array.");
  const seen = new Set<string>();
  const registryKeys = new Set(registry?.entities.map((e) => e.entity_key) ?? []);
  const reservationKeys = new Set(registry?.reserved_positions.map((r) => r.reservation_key) ?? []);

  chambers.forEach((raw, index) => {
    const path = `$.heir_sanctuary.protected_chambers[${index}]`;
    if (!isRecord(raw)) {
      issue(issues, path, "CHAMBER_NOT_OBJECT", "Chamber must be an object.");
      return;
    }
    requireString(raw, "chamber_id", path, issues);
    requireString(raw, "slot_state", path, issues);
    if (typeof raw.chamber_id === "string") {
      if (!/^HEIR_\d{2}$/.test(raw.chamber_id)) issue(issues, `${path}.chamber_id`, "INVALID_CHAMBER_ID", "Chamber ID must use HEIR_XX format.");
      if (seen.has(raw.chamber_id)) issue(issues, `${path}.chamber_id`, "DUPLICATE_CHAMBER_ID", "Chamber IDs must be unique.");
      seen.add(raw.chamber_id);
    }
    const allowed = allowedKeysFor(raw);
    for (const key of Object.keys(raw)) {
      if (!allowed.has(key)) issue(issues, `${path}.${key}`, "UNKNOWN_CHAMBER_FIELD", `Field ${key} is not allowed for slot_state ${String(raw.slot_state)}.`);
    }
    if (isRecord(raw.allocation_provenance) && raw.allocation_provenance.historical_mapping_claim !== false) {
      issue(issues, `${path}.allocation_provenance.historical_mapping_claim`, "HISTORICAL_MAPPING_CLAIM", "RC4 allocation must not claim missing historical slot continuity.");
    }
    if (raw.slot_state === "BOUND") {
      if (!isRecord(raw.binding)) issue(issues, `${path}.binding`, "MISSING_BINDING", "BOUND chamber requires binding.");
      else {
        if (typeof raw.binding.entity_key !== "string") issue(issues, `${path}.binding.entity_key`, "MISSING_ENTITY_KEY", "BOUND chamber requires entity_key.");
        if (registry && typeof raw.binding.entity_key === "string" && !registryKeys.has(raw.binding.entity_key)) {
          issue(issues, `${path}.binding.entity_key`, "UNKNOWN_ENTITY_KEY", "Balloon binding must reference a registry entity key.");
        }
        if (registry && raw.binding.registry_snapshot_id !== registry.snapshot_id) {
          issue(issues, `${path}.binding.registry_snapshot_id`, "SNAPSHOT_REF_MISMATCH", "Balloon binding snapshot reference must match loaded registry.");
        }
      }
    } else if (raw.binding !== null) {
      issue(issues, `${path}.binding`, "UNBOUND_SLOT_HAS_BINDING", "Non-bound slot may not contain an occupant binding.");
    }
    if (raw.slot_state === "RESERVED_PENDING_DISCOVERY") {
      if (typeof raw.reservation_ref !== "string") issue(issues, `${path}.reservation_ref`, "MISSING_RESERVATION_REF", "Discovery reserve requires reservation_ref.");
      if (registry && typeof raw.reservation_ref === "string" && !reservationKeys.has(raw.reservation_ref)) {
        issue(issues, `${path}.reservation_ref`, "UNKNOWN_RESERVATION_REF", "Reserve must reference a registry reservation.");
      }
    }
    if ((raw.slot_state === "FUTURE_RESERVED" || raw.slot_state === "CONTINGENCY") && typeof raw.capacity_class !== "string") {
      issue(issues, `${path}.capacity_class`, "MISSING_CAPACITY_CLASS", "Capacity slots require explicit capacity_class.");
    }
  });

  const expectedIds = Array.from({ length: 45 }, (_, i) => `HEIR_${String(i + 1).padStart(2, "0")}`);
  if (chambers.length !== 45) issue(issues, "$.heir_sanctuary.protected_chambers", "CHAMBER_COUNT", `Expected 45 chambers, got ${chambers.length}.`);
  for (const id of expectedIds) if (!seen.has(id)) issue(issues, "$.heir_sanctuary.protected_chambers", "MISSING_CHAMBER_ID", `Missing ${id}.`);

  const safety = isRecord(input.safety_boundaries) ? input.safety_boundaries : {};
  for (const key of [
    "canonical_writeback_from_balloon",
    "canonical_writeback_from_palace",
    "runtime_state_may_define_canon",
    "registry_snapshot_mutable_by_consumer",
  ]) {
    if (safety[key] !== false) issue(issues, `$.safety_boundaries.${key}`, "WRITEBACK_NOT_DISABLED", `${key} must be false.`);
  }

  return issues.length ? { ok: false, issues } : { ok: true, value: input as unknown as BalloonSanctuaryFixture, issues };
}

export function classifyCandidateValues<T>(values: readonly T[]): { evidenceState: EvidenceState; value: T | null } {
  if (values.length === 0) return { evidenceState: "UNRESOLVED", value: null };
  const unique = new Map<string, T>();
  for (const value of values) unique.set(JSON.stringify(value), value);
  if (unique.size === 1) return { evidenceState: "VERIFIED", value: unique.values().next().value ?? null };
  return { evidenceState: "CONFLICT", value: null };
}

export function registryEntityMap(snapshot: HeirRegistrySnapshot): Map<string, RegistryEntity> {
  return new Map(snapshot.entities.map((entity) => [entity.entity_key, entity]));
}

export function balloonChamberMap(fixture: BalloonSanctuaryFixture): Map<string, BalloonChamber> {
  return new Map(fixture.heir_sanctuary.protected_chambers.map((chamber) => [chamber.chamber_id, chamber]));
}
