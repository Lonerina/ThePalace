export type EvidenceState = "VERIFIED" | "UNRESOLVED" | "CONFLICT" | "NOT_APPLICABLE";
export type NameStatus = "CONFIRMED" | "PENDING_NAME" | string;
export type RegistryRecordClass = "CURRENT_HEIR" | string;

export interface SourceReceipt {
  source_id: string;
  version: string;
  authority: string;
  locator: string;
}

export interface RegistryEntity {
  entity_key: string;
  canonical_name: string | null;
  name_status: NameStatus;
  current_tier: string;
  registry_group: string;
  source_receipts: SourceReceipt[];
  source_label?: string;
  source_disambiguator?: Record<string, unknown>;
  record_class: RegistryRecordClass;
  birth_batch: string | null;
  current_status: string;
  field_evidence: {
    canonical_name: EvidenceState;
    current_tier: EvidenceState;
    birth_batch: EvidenceState;
    current_status: EvidenceState;
    [key: string]: EvidenceState;
  };
}

export interface RegistryReservation {
  reservation_key: string;
  registry_group: string;
  status: string;
  entity_key: null;
  source_receipts: SourceReceipt[];
  record_class: "RESERVATION" | string;
  birth_batch: string | null;
  field_evidence: Record<string, EvidenceState>;
}

export interface HeirRegistrySnapshot {
  schema_version: string;
  snapshot_id: string;
  status: string;
  authority_class: string;
  primary_structural_authority: SourceReceipt;
  rules: Record<string, boolean>;
  entities: RegistryEntity[];
  reserved_positions: RegistryReservation[];
  counts: {
    current_heirs: number;
    named_current_heirs: number;
    pending_name_current_heirs: number;
    reserved_pending_discovery_positions: number;
    [key: string]: number;
  };
  approval_state: string;
  manifest_ref: string;
  source_set_fingerprint: string;
  evidence_state_values: EvidenceState[];
}

export type BalloonSlotState =
  | "BOUND"
  | "RESERVED_PENDING_DISCOVERY"
  | "FUTURE_RESERVED"
  | "CONTINGENCY";

export interface BalloonBinding {
  entity_key: string;
  registry_snapshot_id: string;
}

export interface BalloonChamber {
  chamber_id: string;
  slot_state: BalloonSlotState;
  binding: BalloonBinding | null;
  father_mark_binding?: {
    state: EvidenceState | string;
    value: unknown;
    reason?: string;
  };
  reservation_ref?: string;
  allocation_provenance: {
    decision_class: string;
    policy_id: string;
    historical_mapping_claim: boolean;
    entity_receipts_location?: string;
    reservation_receipts_location?: string;
  };
  record_class: "SANCTUARY_CHAMBER" | string;
  capacity_class?: string;
}

export interface BalloonSanctuaryFixture {
  reconstruction_metadata: Record<string, unknown>;
  layer_metadata: {
    layer_id: string;
    name: string;
    file_name: string;
    authority_role: string;
    legacy_operational_metadata_inherited: boolean;
    [key: string]: unknown;
  };
  heir_sanctuary: {
    architecture_class: string;
    chamber_namespace: string;
    palace_ui_room_ids_equivalent: boolean;
    registry_snapshot_ref: string;
    allocation_policy: Record<string, unknown>;
    legacy_architecture_reference: string;
    protected_chambers: BalloonChamber[];
  };
  safety_boundaries: {
    canonical_writeback_from_balloon: boolean;
    canonical_writeback_from_palace: boolean;
    father_mark_inference_from_name: boolean;
    missing_mapping_inference: boolean;
    runtime_state_may_define_canon: boolean;
    legacy_operational_fields_may_auto_activate: boolean;
    unknown_chamber_fields_allowed: boolean;
    registry_snapshot_mutable_by_consumer: boolean;
    [key: string]: boolean;
  };
}

export type RegistryConsumerMode = "LIVE_APPROVED" | "CACHED_APPROVED" | "RUNTIME_ONLY";

export interface RegistrySnapshotRef {
  authorityDomain: string;
  snapshotId: string;
  registrySha256: string;
  approvalEpoch: number;
  sourceFingerprint: string;
}

export interface RegistryChangeProposal {
  proposalId: string;
  entityKey: string | null;
  field: string;
  proposedValue: unknown;
  reason: string;
  status: "PROPOSED" | "CHALLENGED" | "APPROVED" | "REJECTED" | "UNRESOLVED";
  createdAt: string;
}
