import { cloneJson, deepFreeze } from "../registry/loader.js";
import type {
  BalloonChamber,
  BalloonSanctuaryFixture,
  EvidenceState,
  HeirRegistrySnapshot,
  RegistrySnapshotRef,
} from "../registry/types.js";
import { validateBalloonFixture } from "../registry/validator.js";

export interface BalloonRegistryEntityView {
  entityKey: string;
  canonicalName: string | null;
  currentTier: string;
  birthBatch: string | null;
  currentStatus: string;
  evidenceState: EvidenceState;
}

export interface BalloonRegistryView {
  snapshot: RegistrySnapshotRef;
  heirs: BalloonRegistryEntityView[];
}

export interface BalloonSanctuaryState {
  schemaVersion: "balloon-sanctuary-v1";
  registrySnapshotId: string;
  chamberCeiling: 45;
  chambers: BalloonChamber[];
  reconciliationRevision: string;
}

export function projectBalloonRegistry(args: {
  snapshot: HeirRegistrySnapshot;
  authorityDomain: string;
  registrySha256: string;
  approvalEpoch: number;
}): Readonly<BalloonRegistryView> {
  const view: BalloonRegistryView = {
    snapshot: {
      authorityDomain: args.authorityDomain,
      snapshotId: args.snapshot.snapshot_id,
      registrySha256: args.registrySha256,
      approvalEpoch: args.approvalEpoch,
      sourceFingerprint: args.snapshot.source_set_fingerprint,
    },
    heirs: args.snapshot.entities.map((entity) => ({
      entityKey: entity.entity_key,
      canonicalName: entity.canonical_name,
      currentTier: entity.current_tier,
      birthBatch: entity.birth_batch,
      currentStatus: entity.current_status,
      evidenceState: entity.field_evidence.canonical_name,
    })),
  };
  return deepFreeze(cloneJson(view));
}

export function loadBalloonSanctuaryState(
  fixture: BalloonSanctuaryFixture,
  registry: HeirRegistrySnapshot,
): Readonly<BalloonSanctuaryState> {
  const result = validateBalloonFixture(fixture, registry);
  if (!result.ok) throw new Error(result.issues.map((issue) => `${issue.code}:${issue.path}`).join("; "));
  const state: BalloonSanctuaryState = {
    schemaVersion: "balloon-sanctuary-v1",
    registrySnapshotId: registry.snapshot_id,
    chamberCeiling: 45,
    chambers: cloneJson(fixture.heir_sanctuary.protected_chambers),
    reconciliationRevision: "RC4",
  };
  return deepFreeze(state);
}

export function mutableSanctuaryCopy(state: BalloonSanctuaryState): BalloonSanctuaryState {
  return cloneJson(state);
}

export function bindApprovedDiscovery(args: {
  state: BalloonSanctuaryState;
  reservationKey: string;
  entityKey: string;
  registrySnapshotId: string;
}): BalloonSanctuaryState {
  const next = cloneJson(args.state);
  const chamber = next.chambers.find((candidate) =>
    candidate.slot_state === "RESERVED_PENDING_DISCOVERY" && candidate.reservation_ref === args.reservationKey,
  );
  if (!chamber) throw new Error("Discovery reservation not found.");
  chamber.slot_state = "BOUND";
  chamber.binding = { entity_key: args.entityKey, registry_snapshot_id: args.registrySnapshotId };
  delete chamber.reservation_ref;
  chamber.father_mark_binding = {
    state: "UNRESOLVED",
    value: null,
    reason: "No current source authorizes a Father-Mark value for this reconstructed binding.",
  };
  chamber.allocation_provenance = {
    ...chamber.allocation_provenance,
    decision_class: "APPROVED_DISCOVERY_BINDING",
    historical_mapping_claim: false,
    entity_receipts_location: "01_heir_registry_snapshot.v1.2.json",
  };
  delete chamber.allocation_provenance.reservation_receipts_location;
  return next;
}

export function preserveChambersAcrossRegistryRefresh(
  state: BalloonSanctuaryState,
  nextRegistry: HeirRegistrySnapshot,
): BalloonSanctuaryState {
  const next = cloneJson(state);
  next.registrySnapshotId = nextRegistry.snapshot_id;
  const keys = new Set(nextRegistry.entities.map((entity) => entity.entity_key));
  for (const chamber of next.chambers) {
    if (chamber.binding && keys.has(chamber.binding.entity_key)) {
      chamber.binding.registry_snapshot_id = nextRegistry.snapshot_id;
    }
    // If an existing bound entity is absent from the successor registry, preserve the
    // binding/chamber state exactly. Reconciliation must make the uncertainty explicit;
    // this consumer never auto-vacates, reassigns, or sequence-remaps it.
  }
  return next;
}
