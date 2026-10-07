import { decideV4ClientRouting, AUTHORITY_DOMAIN, V4_ENDPOINTS, type AuthorityRequestContextV1 } from "../authority/protocol.js";
import { classifyLegacyCharacters } from "../legacy/quarantine.js";
import { projectPalaceRegistry, type PalaceRegistryView } from "../consumers/palaceRegistry.js";
import { selectRegistryForRuntime, type RegistryCacheRecordV1 } from "../registry/cache.js";
import { sha256Hex, utf8Bytes } from "../registry/loader.js";
import { currentAnchor, validateApprovedManifest, type ApprovedSnapshotManifestV1 } from "../registry/trustRoot.js";
import type { HeirRegistrySnapshot, RegistryConsumerMode } from "../registry/types.js";
import { migrateV3ToV4, readCommittedMigration } from "./migration.js";
import { STORAGE_KEYS, stableStringify, type StorageAdapter } from "./storage.js";
import type { PalaceRuntimeStateV4 } from "./types.js";

export interface AuthorityBootResult {
  registryMode: RegistryConsumerMode;
  registry: Readonly<HeirRegistrySnapshot> | null;
  palaceRegistry: Readonly<PalaceRegistryView> | null;
  runtime: PalaceRuntimeStateV4;
  authorityRequest: AuthorityRequestContextV1 | null;
  reason: string;
  warnings: string[];
}

export interface FetchLikeResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<FetchLikeResponse>;

function parseCache(storage: StorageAdapter): RegistryCacheRecordV1 | null {
  const text = storage.getItem(STORAGE_KEYS.registryCacheV1);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as RegistryCacheRecordV1;
    return parsed?.schemaVersion === "registry-cache-v1" ? parsed : null;
  } catch {
    return null;
  }
}

function parseRuntime(text: string | null): PalaceRuntimeStateV4 | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as PalaceRuntimeStateV4;
    return parsed?.schemaVersion === "palace-runtime-v4" ? parsed : null;
  } catch {
    return null;
  }
}

export function createFreshRuntimeV4(): PalaceRuntimeStateV4 {
  return {
    schemaVersion: "palace-runtime-v4",
    migratedFrom: null,
    activeUiRoomId: "assembly",
    histories: {},
    relationships: {},
    inventory: [],
    journal: [],
    suggestedChoices: {},
    runtimeProfiles: [],
    sandboxEntities: [],
    runtimeOnly: { installationMode: "DIRECT_V4" },
    warnings: [],
  };
}

export function readRuntimeSession(storage: StorageAdapter): PalaceRuntimeStateV4 | null {
  return parseRuntime(storage.getItem(STORAGE_KEYS.runtimeSessionV4));
}

export function persistRuntimeSession(storage: StorageAdapter, runtime: PalaceRuntimeStateV4): void {
  if (runtime.schemaVersion !== "palace-runtime-v4") throw new Error("Refusing to persist unsupported runtime schema.");
  storage.setItem(STORAGE_KEYS.runtimeSessionV4, stableStringify(runtime));
}

function directV4Base(storage: StorageAdapter): PalaceRuntimeStateV4 | null {
  const runtime = parseRuntime(storage.getItem(STORAGE_KEYS.runtimeV4));
  if (!runtime) return null;
  return runtime.runtimeOnly?.installationMode === "DIRECT_V4" ? runtime : null;
}

function cacheFromLive(args: {
  registryText: string;
  registry: Readonly<HeirRegistrySnapshot>;
  manifest: ApprovedSnapshotManifestV1;
  now: () => string;
}): RegistryCacheRecordV1 {
  const anchor = currentAnchor(args.manifest, AUTHORITY_DOMAIN);
  return {
    schemaVersion: "registry-cache-v1",
    authorityDomain: AUTHORITY_DOMAIN,
    snapshotId: anchor.snapshotId,
    registrySha256: anchor.registrySha256,
    approvalEpoch: anchor.approvalEpoch,
    sourceFingerprint: args.registry.source_set_fingerprint,
    cachedAt: args.now(),
    approval: "APPROVED",
    snapshotText: args.registryText,
  };
}

function overlaySession(base: PalaceRuntimeStateV4, session: PalaceRuntimeStateV4 | null): PalaceRuntimeStateV4 {
  if (!session) return base;
  return {
    ...session,
    migratedFrom: base.migratedFrom,
    warnings: [...new Set([...(base.warnings ?? []), ...(session.warnings ?? [])])],
  };
}

export async function bootPalaceAuthority(args: {
  storage: StorageAdapter;
  builtInIds: ReadonlySet<string>;
  liveRegistryBytes: Uint8Array | null;
  liveRegistryText: string | null;
  manifest: ApprovedSnapshotManifestV1;
  now?: () => string;
}): Promise<AuthorityBootResult> {
  const now = args.now ?? (() => new Date().toISOString());
  validateApprovedManifest(args.manifest);

  const selection = await selectRegistryForRuntime({
    liveBytes: args.liveRegistryBytes,
    cache: parseCache(args.storage),
    manifest: args.manifest,
    authorityDomain: AUTHORITY_DOMAIN,
  });

  let registryCache: RegistryCacheRecordV1 | null = null;
  if (selection.mode === "LIVE_APPROVED" && selection.snapshot && args.liveRegistryText) {
    registryCache = cacheFromLive({ registryText: args.liveRegistryText, registry: selection.snapshot, manifest: args.manifest, now });
  }

  let baseRuntime: PalaceRuntimeStateV4 | null = null;
  const committed = await readCommittedMigration(args.storage);
  const warnings: string[] = [];
  if (committed?.status === "RECOVERY_REQUIRED") {
    warnings.push("MIGRATION_RECOVERY_REQUIRED", committed.reason);
  } else if (committed?.status === "COMMITTED_V4") {
    baseRuntime = committed.runtime;
    warnings.push(...committed.warnings);
  }

  if (!baseRuntime && !committed) {
    const direct = directV4Base(args.storage);
    if (direct) {
      baseRuntime = direct;
      if (args.storage.getItem(STORAGE_KEYS.legacyV3)) warnings.push("LEGACY_V3_IGNORED_AFTER_DIRECT_V4");
    } else {
      const migrated = await migrateV3ToV4({
        storage: args.storage,
        builtInIds: args.builtInIds,
        registry: selection.snapshot,
        registryCache,
        now,
      });
      if (migrated.status === "MIGRATED" || migrated.status === "COMMITTED_V4") {
        baseRuntime = migrated.runtime;
        warnings.push(...migrated.warnings);
      } else if (migrated.status === "NO_LEGACY_STATE") {
        baseRuntime = createFreshRuntimeV4();
        args.storage.setItem(STORAGE_KEYS.runtimeV4, stableStringify(baseRuntime));
        if (registryCache) args.storage.setItem(STORAGE_KEYS.registryCacheV1, stableStringify(registryCache));
      } else {
        warnings.push("MIGRATION_RECOVERY_REQUIRED", migrated.reason);
      }
    }
  }

  const runtime = overlaySession(baseRuntime ?? createFreshRuntimeV4(), readRuntimeSession(args.storage));
  let palaceRegistry: Readonly<PalaceRegistryView> | null = null;
  if (selection.snapshot) {
    const anchor = currentAnchor(args.manifest, AUTHORITY_DOMAIN);
    palaceRegistry = projectPalaceRegistry({
      snapshot: selection.snapshot,
      authorityDomain: AUTHORITY_DOMAIN,
      registrySha256: anchor.registrySha256,
      approvalEpoch: anchor.approvalEpoch,
    });
  }

  return {
    registryMode: selection.mode,
    registry: selection.snapshot,
    palaceRegistry,
    runtime,
    authorityRequest: null,
    reason: selection.reason,
    warnings,
  };
}

export function buildRuntimeState(args: {
  previous: PalaceRuntimeStateV4;
  activeUiRoomId: string;
  histories: Record<string, unknown>;
  relationships: Record<string, unknown>;
  inventory: unknown[];
  journal: unknown[];
  suggestedChoices: Record<string, unknown>;
  displayCharacters: unknown[];
  builtInIds: ReadonlySet<string>;
  canonicalNames?: ReadonlySet<string>;
}): PalaceRuntimeStateV4 {
  const classified = classifyLegacyCharacters({
    records: args.displayCharacters,
    builtInIds: args.builtInIds,
    canonicalNames: args.canonicalNames,
  });
  return {
    ...args.previous,
    activeUiRoomId: args.activeUiRoomId,
    histories: JSON.parse(JSON.stringify(args.histories)),
    relationships: JSON.parse(JSON.stringify(args.relationships)),
    inventory: JSON.parse(JSON.stringify(args.inventory)),
    journal: JSON.parse(JSON.stringify(args.journal)),
    suggestedChoices: JSON.parse(JSON.stringify(args.suggestedChoices)),
    runtimeProfiles: classified.builtinRuntimeProfiles,
    sandboxEntities: classified.sandboxEntities,
    runtimeOnly: {
      ...(args.previous.runtimeOnly ?? {}),
      displayCharacters: JSON.parse(JSON.stringify(args.displayCharacters)),
    },
    warnings: [...new Set([...(args.previous.warnings ?? []), ...classified.warnings])],
  };
}

export function restoreDisplayCharacters(runtime: PalaceRuntimeStateV4, builtIns: unknown[]): unknown[] {
  const stored = runtime.runtimeOnly?.displayCharacters;
  if (Array.isArray(stored)) return JSON.parse(JSON.stringify(stored));
  const base = JSON.parse(JSON.stringify(builtIns)) as Array<Record<string, unknown>>;
  const profiles = new Map(runtime.runtimeProfiles.map((profile) => [profile.localId, profile.runtimePresentation]));
  for (const character of base) {
    const id = typeof character.id === "string" ? character.id : "";
    const profile = profiles.get(id);
    if (profile) Object.assign(character, JSON.parse(JSON.stringify(profile)));
  }
  for (const sandbox of runtime.sandboxEntities) base.push(JSON.parse(JSON.stringify(sandbox.record)));
  return base;
}

export async function negotiateV4Authority(args: {
  fetcher: FetchLike;
  manifest: ApprovedSnapshotManifestV1;
  registryMode: RegistryConsumerMode;
}): Promise<{ mode: "REGISTRY_V4" | "RUNTIME_ONLY"; authority: AuthorityRequestContextV1 | null; reason: string }> {
  if (args.registryMode === "RUNTIME_ONLY") return { mode: "RUNTIME_ONLY", authority: null, reason: "No approved local registry is available." };
  const anchor = currentAnchor(args.manifest, AUTHORITY_DOMAIN);
  let response: FetchLikeResponse;
  try {
    response = await args.fetcher(V4_ENDPOINTS.authority);
  } catch {
    return { mode: "RUNTIME_ONLY", authority: null, reason: "Authority handshake endpoint is unavailable." };
  }
  if (!response.ok) return { mode: "RUNTIME_ONLY", authority: null, reason: `Authority handshake failed with HTTP ${response.status}.` };
  const body = await response.json() as any;
  const routing = decideV4ClientRouting(body?.authorityMode === "REGISTRY_V4" ? body : null, anchor);
  if (routing.mode !== "REGISTRY_V4") return { mode: "RUNTIME_ONLY", authority: null, reason: "Server authority handshake is not current." };
  return {
    mode: "REGISTRY_V4",
    authority: {
      authorityProtocol: body.authorityProtocol,
      authorityDomain: body.authorityDomain,
      snapshotId: body.currentSnapshotId,
      registrySha256: body.currentRegistrySha256,
      approvalEpoch: body.approvalEpoch,
    },
    reason: "AC-AUTH/1 handshake matches CURRENT approved registry.",
  };
}

export function buildV4NarrativeRequest(authority: AuthorityRequestContextV1, runtime: Record<string, unknown>): {
  authority: AuthorityRequestContextV1;
  runtime: Record<string, unknown>;
} {
  const allowedKeys = [
    "chamberId",
    "history",
    "playerInput",
    "relationships",
    "inventory",
    "journal",
    "attachedFile",
  ] as const;
  const cleaned: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(runtime, key)) cleaned[key] = runtime[key];
  }
  return { authority: { ...authority }, runtime: cleaned };
}

export async function verifyLiveRegistryHash(registryText: string, manifest: ApprovedSnapshotManifestV1): Promise<boolean> {
  const anchor = currentAnchor(manifest, AUTHORITY_DOMAIN);
  return await sha256Hex(utf8Bytes(registryText)) === anchor.registrySha256;
}
