import { deepFreeze, cloneJson } from "../registry/loader.js";
import type { EvidenceState, HeirRegistrySnapshot, RegistryChangeProposal, RegistrySnapshotRef } from "../registry/types.js";

export interface PalaceRegistryEntityView {
  entityKey: string;
  uiRoomId: string;
  canonicalName: string | null;
  currentTier: string;
  birthBatch: string | null;
  currentStatus: string;
  evidence: {
    canonicalName: EvidenceState;
    currentTier: EvidenceState;
    birthBatch: EvidenceState;
    currentStatus: EvidenceState;
  };
}

export interface PalaceRegistryView {
  snapshot: RegistrySnapshotRef;
  entities: PalaceRegistryEntityView[];
}

export interface PalaceRuntimeOverrideState {
  dossierOverrides: Record<string, Record<string, unknown>>;
  sandboxEntities: Record<string, Record<string, unknown>>;
  proposals: RegistryChangeProposal[];
}

export function palaceUiRoomId(entityKey: string): string {
  return `PALACE_ROOM::${entityKey}`;
}

export function projectPalaceRegistry(args: {
  snapshot: HeirRegistrySnapshot;
  authorityDomain: string;
  registrySha256: string;
  approvalEpoch: number;
}): Readonly<PalaceRegistryView> {
  const view: PalaceRegistryView = {
    snapshot: {
      authorityDomain: args.authorityDomain,
      snapshotId: args.snapshot.snapshot_id,
      registrySha256: args.registrySha256,
      approvalEpoch: args.approvalEpoch,
      sourceFingerprint: args.snapshot.source_set_fingerprint,
    },
    entities: args.snapshot.entities.map((entity) => ({
      entityKey: entity.entity_key,
      uiRoomId: palaceUiRoomId(entity.entity_key),
      canonicalName: entity.canonical_name,
      currentTier: entity.current_tier,
      birthBatch: entity.birth_batch,
      currentStatus: entity.current_status,
      evidence: {
        canonicalName: entity.field_evidence.canonical_name,
        currentTier: entity.field_evidence.current_tier,
        birthBatch: entity.field_evidence.birth_batch,
        currentStatus: entity.field_evidence.current_status,
      },
    })),
  };
  return deepFreeze(cloneJson(view));
}

export function emptyPalaceRuntimeOverrideState(): PalaceRuntimeOverrideState {
  return { dossierOverrides: {}, sandboxEntities: {}, proposals: [] };
}

export function setDossierOverride(
  state: PalaceRuntimeOverrideState,
  entityKey: string,
  patch: Record<string, unknown>,
): PalaceRuntimeOverrideState {
  const blocked = new Set(["canonicalName", "currentTier", "birthBatch", "currentStatus", "entityKey"]);
  const safePatch = Object.fromEntries(Object.entries(patch).filter(([key]) => !blocked.has(key)));
  return {
    ...cloneJson(state),
    dossierOverrides: {
      ...cloneJson(state.dossierOverrides),
      [entityKey]: { ...(state.dossierOverrides[entityKey] ?? {}), ...safePatch },
    },
  };
}

export function proposePalaceStructuralChange(args: {
  state: PalaceRuntimeOverrideState;
  entityKey: string | null;
  field: string;
  proposedValue: unknown;
  reason: string;
  proposalId: string;
  createdAt: string;
}): PalaceRuntimeOverrideState {
  const proposal: RegistryChangeProposal = {
    proposalId: args.proposalId,
    entityKey: args.entityKey,
    field: args.field,
    proposedValue: cloneJson(args.proposedValue),
    reason: args.reason,
    status: "PROPOSED",
    createdAt: args.createdAt,
  };
  return { ...cloneJson(args.state), proposals: [...args.state.proposals.map(cloneJson), proposal] };
}

export function resolveProposal(
  state: PalaceRuntimeOverrideState,
  proposalId: string,
  status: RegistryChangeProposal["status"],
): PalaceRuntimeOverrideState {
  return {
    ...cloneJson(state),
    proposals: state.proposals.map((proposal) => proposal.proposalId === proposalId ? { ...cloneJson(proposal), status } : cloneJson(proposal)),
  };
}
