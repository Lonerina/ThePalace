import { classifyLegacyCharacters } from "../legacy/quarantine.js";
import { sha256Hex, utf8Bytes } from "../registry/loader.js";
import type { RegistryCacheRecordV1 } from "../registry/cache.js";
import type { HeirRegistrySnapshot } from "../registry/types.js";
import { STORAGE_KEYS, stableStringify, type StorageAdapter } from "./storage.js";
import type { LegacyQuarantineV1, MigrationCommitV1, PalaceRuntimeStateV4 } from "./types.js";

export type MigrationBootResult =
  | { status: "COMMITTED_V4"; runtime: PalaceRuntimeStateV4; quarantine: LegacyQuarantineV1; warnings: string[] }
  | { status: "MIGRATED"; runtime: PalaceRuntimeStateV4; quarantine: LegacyQuarantineV1; commit: MigrationCommitV1; warnings: string[] }
  | { status: "NO_LEGACY_STATE"; warnings: string[] }
  | { status: "RECOVERY_REQUIRED"; warnings: string[]; reason: string };

function parseObject(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  const parsed = JSON.parse(text) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
}

async function hashText(text: string): Promise<string> {
  return sha256Hex(utf8Bytes(text));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? clone(value as Record<string, unknown>) : {};
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? clone(value) : [];
}

function buildCandidates(args: {
  legacy: Record<string, unknown>;
  sourceV3Hash: string;
  builtInIds: ReadonlySet<string>;
  registry?: HeirRegistrySnapshot | null;
}): { runtime: PalaceRuntimeStateV4; quarantine: LegacyQuarantineV1 } {
  const canonicalNames = new Set(
    (args.registry?.entities ?? [])
      .map((entity) => entity.canonical_name)
      .filter((name): name is string => typeof name === "string"),
  );
  const classified = classifyLegacyCharacters({
    records: args.legacy.characters,
    builtInIds: args.builtInIds,
    canonicalNames,
  });

  const warnings = [...classified.warnings];
  const runtime: PalaceRuntimeStateV4 = {
    schemaVersion: "palace-runtime-v4",
    migratedFrom: "anchor_court_game_state_v3",
    activeUiRoomId: typeof args.legacy.activeChamberId === "string" ? args.legacy.activeChamberId : null,
    histories: recordOrEmpty(args.legacy.histories),
    relationships: recordOrEmpty(args.legacy.relationships),
    inventory: arrayOrEmpty(args.legacy.inventory),
    journal: arrayOrEmpty(args.legacy.journal),
    suggestedChoices: recordOrEmpty(args.legacy.suggestedChoices),
    runtimeProfiles: classified.builtinRuntimeProfiles,
    sandboxEntities: classified.sandboxEntities,
    runtimeOnly: {},
    warnings,
  };

  const legacyStructuralTopLevel: Record<string, unknown> = {};
  for (const key of ["scrollText", "characters"]) {
    if (key in args.legacy) legacyStructuralTopLevel[key] = clone(args.legacy[key]);
  }
  const quarantine: LegacyQuarantineV1 = {
    schemaVersion: "legacy-quarantine-v1",
    sourceKey: "anchor_court_game_state_v3",
    sourceV3Hash: args.sourceV3Hash,
    oldScrollDraft: "scrollText" in args.legacy ? { value: clone(args.legacy.scrollText), authority: "NONE" } : null,
    builtinStructuralRecords: classified.builtinQuarantine,
    legacyStructuralTopLevel,
    warnings,
  };
  return { runtime, quarantine };
}

async function verifyCommittedObjects(storage: StorageAdapter, commit: MigrationCommitV1): Promise<{
  ok: boolean;
  runtime?: PalaceRuntimeStateV4;
  quarantine?: LegacyQuarantineV1;
  reason?: string;
}> {
  const runtimeText = storage.getItem(STORAGE_KEYS.runtimeV4);
  const quarantineText = storage.getItem(STORAGE_KEYS.quarantineV1);
  if (!runtimeText || !quarantineText) return { ok: false, reason: "Committed migration references missing v4 objects." };
  if (await hashText(runtimeText) !== commit.runtimeV4Hash) return { ok: false, reason: "Committed runtime-v4 hash mismatch." };
  if (await hashText(quarantineText) !== commit.quarantineV1Hash) return { ok: false, reason: "Committed quarantine-v1 hash mismatch." };
  if (commit.registryCacheHash) {
    const cacheText = storage.getItem(STORAGE_KEYS.registryCacheV1);
    if (!cacheText || await hashText(cacheText) !== commit.registryCacheHash) return { ok: false, reason: "Committed registry-cache hash mismatch." };
  }
  try {
    const runtime = JSON.parse(runtimeText) as PalaceRuntimeStateV4;
    const quarantine = JSON.parse(quarantineText) as LegacyQuarantineV1;
    if (runtime.schemaVersion !== "palace-runtime-v4" || quarantine.schemaVersion !== "legacy-quarantine-v1") {
      return { ok: false, reason: "Committed v4 objects use unsupported schema versions." };
    }
    return { ok: true, runtime, quarantine };
  } catch {
    return { ok: false, reason: "Committed v4 object JSON is corrupt." };
  }
}

export async function readCommittedMigration(storage: StorageAdapter): Promise<MigrationBootResult | null> {
  const commitText = storage.getItem(STORAGE_KEYS.migrationCommitV1);
  if (!commitText) return null;
  let commit: MigrationCommitV1;
  try {
    commit = JSON.parse(commitText) as MigrationCommitV1;
  } catch {
    return { status: "RECOVERY_REQUIRED", warnings: [], reason: "Migration commit marker is malformed." };
  }
  if (commit.status !== "COMMITTED" || commit.migrationVersion !== "v3-to-v4-1") {
    return { status: "RECOVERY_REQUIRED", warnings: [], reason: "Migration commit marker is invalid." };
  }
  const verified = await verifyCommittedObjects(storage, commit);
  if (!verified.ok || !verified.runtime || !verified.quarantine) {
    return { status: "RECOVERY_REQUIRED", warnings: [], reason: verified.reason ?? "Committed migration integrity failure." };
  }

  const warnings: string[] = [];
  const currentV3 = storage.getItem(STORAGE_KEYS.legacyV3);
  if (currentV3 && await hashText(currentV3) !== commit.sourceV3Hash) warnings.push("LEGACY_V3_CHANGED_AFTER_COMMIT");
  return { status: "COMMITTED_V4", runtime: verified.runtime, quarantine: verified.quarantine, warnings };
}

export async function migrateV3ToV4(args: {
  storage: StorageAdapter;
  builtInIds: ReadonlySet<string>;
  registry?: HeirRegistrySnapshot | null;
  registryCache?: RegistryCacheRecordV1 | null;
  now?: () => string;
  migrationId?: string;
}): Promise<MigrationBootResult> {
  const committed = await readCommittedMigration(args.storage);
  if (committed) return committed;

  const rawV3 = args.storage.getItem(STORAGE_KEYS.legacyV3);
  if (!rawV3) return { status: "NO_LEGACY_STATE", warnings: [] };
  const sourceV3Hash = await hashText(rawV3);

  let legacy: Record<string, unknown>;
  try {
    const parsed = parseObject(rawV3);
    if (!parsed) throw new Error("Legacy v3 root must be an object.");
    legacy = parsed;
  } catch (error) {
    return { status: "RECOVERY_REQUIRED", warnings: [], reason: error instanceof Error ? error.message : "Legacy v3 parse failed." };
  }

  const { runtime, quarantine } = buildCandidates({
    legacy,
    sourceV3Hash,
    builtInIds: args.builtInIds,
    registry: args.registry,
  });
  const runtimeText = stableStringify(runtime);
  const quarantineText = stableStringify(quarantine);
  const runtimeV4Hash = await hashText(runtimeText);
  const quarantineV1Hash = await hashText(quarantineText);
  const cacheText = args.registryCache ? stableStringify(args.registryCache) : null;
  const registryCacheHash = cacheText ? await hashText(cacheText) : undefined;

  try {
    args.storage.setItem(STORAGE_KEYS.runtimeV4, runtimeText);
    args.storage.setItem(STORAGE_KEYS.quarantineV1, quarantineText);
    if (cacheText) args.storage.setItem(STORAGE_KEYS.registryCacheV1, cacheText);

    if (args.storage.getItem(STORAGE_KEYS.runtimeV4) !== runtimeText) throw new Error("runtime-v4 readback mismatch.");
    if (args.storage.getItem(STORAGE_KEYS.quarantineV1) !== quarantineText) throw new Error("quarantine-v1 readback mismatch.");
    if (cacheText && args.storage.getItem(STORAGE_KEYS.registryCacheV1) !== cacheText) throw new Error("registry-cache readback mismatch.");

    const commit: MigrationCommitV1 = {
      migrationId: args.migrationId ?? `migration-${sourceV3Hash.slice(0, 16)}`,
      migrationVersion: "v3-to-v4-1",
      sourceV3Hash,
      runtimeV4Hash,
      quarantineV1Hash,
      ...(registryCacheHash ? { registryCacheHash } : {}),
      ...(args.registryCache ? {
        approvedSnapshotId: args.registryCache.snapshotId,
        approvedRegistrySha256: args.registryCache.registrySha256,
        approvedEpoch: args.registryCache.approvalEpoch,
      } : {}),
      committedAt: (args.now ?? (() => new Date().toISOString()))(),
      status: "COMMITTED",
    };
    const commitText = stableStringify(commit);
    args.storage.setItem(STORAGE_KEYS.migrationCommitV1, commitText); // COMMIT MARKER LAST
    if (args.storage.getItem(STORAGE_KEYS.migrationCommitV1) !== commitText) throw new Error("commit-marker readback mismatch.");
    const verified = await readCommittedMigration(args.storage);
    if (!verified || verified.status !== "COMMITTED_V4") throw new Error("post-commit verification failed.");
    return { status: "MIGRATED", runtime, quarantine, commit, warnings: [] };
  } catch (error) {
    return {
      status: "RECOVERY_REQUIRED",
      warnings: ["MIGRATION_UNCOMMITTED_PARTIAL_STATE_IGNORED"],
      reason: error instanceof Error ? error.message : "Migration write failed.",
    };
  }
}
