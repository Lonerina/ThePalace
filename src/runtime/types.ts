import type { LegacyBuiltinRuntimeProfile, LegacySandboxEntity } from "../legacy/quarantine.js";

export interface PalaceRuntimeStateV4 {
  schemaVersion: "palace-runtime-v4";
  migratedFrom: "anchor_court_game_state_v3" | null;
  activeUiRoomId: string | null;
  histories: Record<string, unknown>;
  relationships: Record<string, unknown>;
  inventory: unknown[];
  journal: unknown[];
  suggestedChoices: Record<string, unknown>;
  runtimeProfiles: LegacyBuiltinRuntimeProfile[];
  sandboxEntities: LegacySandboxEntity[];
  runtimeOnly: Record<string, unknown>;
  warnings: string[];
}

export interface LegacyQuarantineV1 {
  schemaVersion: "legacy-quarantine-v1";
  sourceKey: "anchor_court_game_state_v3";
  sourceV3Hash: string;
  oldScrollDraft: { value: unknown; authority: "NONE" } | null;
  builtinStructuralRecords: unknown[];
  legacyStructuralTopLevel: Record<string, unknown>;
  warnings: string[];
}

export interface MigrationCommitV1 {
  migrationId: string;
  migrationVersion: "v3-to-v4-1";
  sourceV3Hash: string;
  runtimeV4Hash: string;
  quarantineV1Hash: string;
  registryCacheHash?: string;
  approvedSnapshotId?: string;
  approvedRegistrySha256?: string;
  approvedEpoch?: number;
  committedAt: string;
  status: "COMMITTED";
}
