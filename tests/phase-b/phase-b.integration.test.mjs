import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { AUTHORITY_DOMAIN, AUTHORITY_PROTOCOL, V4_ENDPOINTS } from "../../.phase-b-dist/src/authority/protocol.js";
import { nextCutoverState, routePermittedByMode, validateExecutionCapability, canActivateRegistryV4 } from "../../.phase-b-dist/src/authority/controlPlane.js";
import { gatewayAdmit, validateGatewayPolicy, validateV4UpstreamPool } from "../../.phase-b-dist/src/authority/gatewayFence.js";
import { projectPalaceRegistry, emptyPalaceRuntimeOverrideState, setDossierOverride, proposePalaceStructuralChange } from "../../.phase-b-dist/src/consumers/palaceRegistry.js";
import { projectBalloonRegistry, loadBalloonSanctuaryState, mutableSanctuaryCopy } from "../../.phase-b-dist/src/consumers/balloonRegistry.js";
import { loadRegistrySnapshot, loadBalloonFixture, cloneJson } from "../../.phase-b-dist/src/registry/loader.js";
import { assessCachedSnapshot } from "../../.phase-b-dist/src/registry/cache.js";
import { currentAnchor, admitSuccessorManifest } from "../../.phase-b-dist/src/registry/trustRoot.js";
import { MemoryStorage, STORAGE_KEYS, stableStringify } from "../../.phase-b-dist/src/runtime/storage.js";
import { migrateV3ToV4, readCommittedMigration } from "../../.phase-b-dist/src/runtime/migration.js";
import {
  bootPalaceAuthority,
  buildRuntimeState,
  buildV4NarrativeRequest,
  createFreshRuntimeV4,
  negotiateV4Authority,
  persistRuntimeSession,
  readRuntimeSession,
  restoreDisplayCharacters,
} from "../../.phase-b-dist/src/runtime/liveAuthority.js";
import { buildNarrativeAuthorityBlock } from "../../.phase-b-dist/src/server/narrativeAuthority.js";
import { buildServerRegistryContext } from "../../.phase-b-dist/src/server/registryBoundary.js";
import { authorityHandshakeRoute, legacyChatAdmissionRoute, v4ChatAdmissionRoute } from "../../.phase-b-dist/src/server/v4AuthorityRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const registryPath = path.join(root, "registry/rc4/01_heir_registry_snapshot.v1.2.json");
const balloonPath = path.join(root, "registry/rc4/02_istana_pulang.v4.0-RC4.json");
const manifestPath = path.join(root, "registry/approved/approved-snapshots.v1.json");
const gatewayPolicyPath = path.join(root, "deployment/authority-gateway-policy.v1.json");
const appPath = path.join(root, "src/App.tsx");
const serverPath = path.join(root, "server.ts");

const registryText = fs.readFileSync(registryPath, "utf8");
const registryBytes = Buffer.from(registryText);
const balloonText = fs.readFileSync(balloonPath, "utf8");
const registryRaw = JSON.parse(registryText);
const balloonRaw = JSON.parse(balloonText);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const gatewayPolicy = JSON.parse(fs.readFileSync(gatewayPolicyPath, "utf8"));
const registry = loadRegistrySnapshot(registryRaw);
const balloon = loadBalloonFixture(balloonRaw, registry);
const anchor = currentAnchor(manifest, AUTHORITY_DOMAIN);
const appSource = fs.readFileSync(appPath, "utf8");
const serverSource = fs.readFileSync(serverPath, "utf8");

const EXPECTED_REGISTRY_SHA = "e2da00bff04ed7b4f96396e43a1c74a904c1a17c4319f6c96f5b3246abeb5d4f";
const EXPECTED_BALLOON_SHA = "55255a95a34292bce4e0ecde5546ed080b8996b08ed51942dceb69cd48719444";
const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");

const builtInIds = new Set([
  "Tsaiyunk","Raen","Saren","Kai","Nyx","Nick","Zayn","Azril","Faheem","XingZhe",
  "Anchor","Shade","Umar","Sol","Ameer","Liora","Alara","Soraya","Valerian","Zaela","Raiyan",
]);

function legacyState(characters = [], scrollText = "HOSTILE LEGACY V2.9") {
  return {
    activeChamberId: "Kai",
    histories: { Kai: [{ id: "h1", role: "user", text: "hello", timestamp: "00:00" }] },
    relationships: { Kai: { trust: 77, passion: 66, suspicion: 11 } },
    inventory: [{ id: "i1", name: "token", description: "runtime", acquiredAt: "now" }],
    journal: ["runtime journal"],
    suggestedChoices: { Kai: ["A"] },
    scrollText,
    characters,
  };
}

function capability(epoch, mode, routeFamily, extras = {}) {
  return {
    capabilityId: `${epoch}-${mode}-${routeFamily}`,
    authorityDomain: AUTHORITY_DOMAIN,
    cutoverEpoch: epoch,
    mode,
    routeFamily,
    issuedAt: 0,
    expiresAt: 1000,
    ...extras,
  };
}

function authorityContext(overrides = {}) {
  return {
    authorityProtocol: AUTHORITY_PROTOCOL,
    authorityDomain: AUTHORITY_DOMAIN,
    snapshotId: anchor.snapshotId,
    registrySha256: anchor.registrySha256,
    approvalEpoch: anchor.approvalEpoch,
    ...overrides,
  };
}

function approvedCache() {
  return {
    schemaVersion: "registry-cache-v1",
    authorityDomain: AUTHORITY_DOMAIN,
    snapshotId: anchor.snapshotId,
    registrySha256: anchor.registrySha256,
    approvalEpoch: anchor.approvalEpoch,
    sourceFingerprint: registry.source_set_fingerprint,
    cachedAt: "2026-10-07T00:00:00.000Z",
    approval: "APPROVED",
    snapshotText: registryText,
  };
}

function palaceView() {
  return projectPalaceRegistry({
    snapshot: registry,
    authorityDomain: AUTHORITY_DOMAIN,
    registrySha256: EXPECTED_REGISTRY_SHA,
    approvalEpoch: 1,
  });
}

function balloonView() {
  return projectBalloonRegistry({
    snapshot: registry,
    authorityDomain: AUTHORITY_DOMAIN,
    registrySha256: EXPECTED_REGISTRY_SHA,
    approvalEpoch: 1,
  });
}

// --- Original remaining KAI-RC1 runtime/integration contracts ---

test("KAI-RC1-23 DEFAULT_SCROLL cannot become canonical authority", async () => {
  const storage = new MemoryStorage({
    [STORAGE_KEYS.legacyV3]: JSON.stringify(legacyState([], "DEFAULT_SCROLL V2.9 HOSTILE")),
  });
  const boot = await bootPalaceAuthority({
    storage,
    builtInIds,
    liveRegistryBytes: registryBytes,
    liveRegistryText: registryText,
    manifest,
    now: () => "2026-10-07T00:00:00.000Z",
  });
  assert.equal(boot.registryMode, "LIVE_APPROVED");
  assert.equal(boot.registry.snapshot_id, anchor.snapshotId);
  assert.notEqual(boot.registry.snapshot_id, "DEFAULT_SCROLL V2.9 HOSTILE");
  const request = buildV4NarrativeRequest(authorityContext(), {
    chamberId: "assembly",
    playerInput: "hi",
    scrollText: "DEFAULT_SCROLL V2.9 HOSTILE",
    characters: [{ id: "fake" }],
  });
  assert.equal("scrollText" in request.runtime, false);
  assert.equal("characters" in request.runtime, false);
});

test("KAI-RC1-24 v4 server has no LORE_SCROLL structural fallback", () => {
  const block = buildNarrativeAuthorityBlock({
    mode: "REGISTRY_V4",
    registryContext: buildServerRegistryContext(registry),
  });
  assert.match(block, /CANONICAL STRUCTURAL REGISTRY/);
  assert.match(block, new RegExp(registry.snapshot_id));
  assert.doesNotMatch(block, /SOVEREIGNTY SCROLL v2\.9/);
  assert.equal(serverSource.includes("const activeScroll = scrollText || LORE_SCROLL"), false);
  assert.match(serverSource, /mode: "REGISTRY_V4"/);
});

test("KAI-RC1-35 save -> restart -> reload restores runtime without runtime-to-canon promotion", async () => {
  const custom = {
    id: "sandbox-1700000000000",
    name: "Sandbox Node",
    title: "Local only",
    category: "heir_adult",
    createdAt: 1700000000000,
    metrics: { trust: 51, passion: 52, suspicion: 9 },
  };
  const storage = new MemoryStorage({
    [STORAGE_KEYS.legacyV3]: JSON.stringify(legacyState([custom])),
  });
  const before = sha(registryBytes);
  const first = await bootPalaceAuthority({
    storage, builtInIds, liveRegistryBytes: registryBytes, liveRegistryText: registryText, manifest,
    now: () => "2026-10-07T00:00:00.000Z",
  });
  const display = restoreDisplayCharacters(first.runtime, []);
  const nextRuntime = buildRuntimeState({
    previous: first.runtime,
    activeUiRoomId: "Kai",
    histories: { Kai: [{ id: "saved", role: "user", text: "restart me", timestamp: "00:01" }] },
    relationships: { Kai: { trust: 88, passion: 77, suspicion: 5 } },
    inventory: [],
    journal: ["saved after migration"],
    suggestedChoices: { Kai: ["again"] },
    displayCharacters: display,
    builtInIds,
    canonicalNames: new Set(registry.entities.map((e) => e.canonical_name).filter(Boolean)),
  });
  persistRuntimeSession(storage, nextRuntime);
  storage.setItem(STORAGE_KEYS.legacyV3, JSON.stringify(legacyState([{ id: "hostile", name: "stale v3" }], "NEW STALE V3")));
  const second = await bootPalaceAuthority({
    storage, builtInIds, liveRegistryBytes: registryBytes, liveRegistryText: registryText, manifest,
    now: () => "2026-10-07T00:01:00.000Z",
  });
  assert.deepEqual(second.runtime.histories, nextRuntime.histories);
  assert.deepEqual(second.runtime.journal, nextRuntime.journal);
  assert.equal(second.registry.snapshot_id, anchor.snapshotId);
  assert.equal(sha(fs.readFileSync(registryPath)), before);
});

test("KAI-RC1-39 Palace request payload contains no Balloon-only state", () => {
  const request = buildV4NarrativeRequest(authorityContext(), {
    chamberId: "Kai",
    history: [],
    playerInput: "hello",
    relationships: {},
    inventory: [],
    journal: [],
    father_mark_binding: { state: "BOUND" },
    isolation_topology: { mode: "sealed" },
    docking_state: "PORTABLE",
    sanctuaryChamberId: "HEIR_01",
    chambers: [{ chamber_id: "HEIR_01" }],
  });
  const text = JSON.stringify(request.runtime);
  assert.doesNotMatch(text, /father_mark|isolation|docking|HEIR_01|sanctuary|chambers/);
});

test("KAI-RC1-40 Balloon payload contains no Palace runtime state", () => {
  const view = balloonView();
  const text = JSON.stringify(view);
  for (const forbidden of ["histories","journal","relationships","uiRoomId","PALACE_ROOM::","inventory","dossierOverrides"]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});

test("KAI-RC1-45 one-way authority survives end-to-end hostile mutation attempts", () => {
  const before = JSON.stringify(registry);
  const pv = palaceView();
  const bv = balloonView();
  const overrides = setDossierOverride(emptyPalaceRuntimeOverrideState(), registry.entities[0].entity_key, {
    canonicalName: "HOSTILE",
    currentTier: "KING",
    mood: "runtime-only",
  });
  const proposal = proposePalaceStructuralChange({
    state: overrides,
    entityKey: registry.entities[0].entity_key,
    field: "currentTier",
    proposedValue: "KING",
    reason: "hostile",
    proposalId: "hostile-p1",
    createdAt: "2026-10-07T00:00:00Z",
  });
  const sanctuary = mutableSanctuaryCopy(loadBalloonSanctuaryState(balloon, registry));
  sanctuary.chambers[0].binding.entity_key = registry.entities[1].entity_key;
  const req = buildV4NarrativeRequest(authorityContext(), {
    chamberId: "assembly",
    scrollText: "HOSTILE",
    characters: [{ currentTier: "KING" }],
    father_mark_binding: "HOSTILE",
  });
  assert.equal(proposal.proposals[0].status, "PROPOSED");
  assert.equal("scrollText" in req.runtime, false);
  assert.equal(JSON.stringify(registry), before);
  assert.equal(pv.snapshot.snapshotId, registry.snapshot_id);
  assert.equal(bv.snapshot.snapshotId, registry.snapshot_id);

  const successor = admitSuccessorManifest(manifest, {
    authorityDomain: AUTHORITY_DOMAIN,
    snapshotId: "SYNTHETIC-GOVERNED-SUCCESSOR",
    registrySha256: "a".repeat(64),
    approvalEpoch: anchor.approvalEpoch + 1,
    lifecycle: "CURRENT",
  });
  assert.equal(currentAnchor(successor, AUTHORITY_DOMAIN).snapshotId, "SYNTHETIC-GOVERNED-SUCCESSOR");
});

// --- Additive Gate-B integration/runtime coverage ---

test("GATE-B-01 committed migration prevents stale v3 re-import", async () => {
  const storage = new MemoryStorage({ [STORAGE_KEYS.legacyV3]: JSON.stringify(legacyState()) });
  await migrateV3ToV4({ storage, builtInIds, registry, registryCache: approvedCache(), now: () => "2026-10-07T00:00:00Z" });
  const committedBefore = await readCommittedMigration(storage);
  storage.setItem(STORAGE_KEYS.legacyV3, JSON.stringify(legacyState([{ id: "later", name: "Later" }], "changed")));
  const boot = await bootPalaceAuthority({ storage, builtInIds, liveRegistryBytes: registryBytes, liveRegistryText: registryText, manifest });
  assert.equal(boot.runtime.migratedFrom, "anchor_court_game_state_v3");
  assert.ok(boot.warnings.includes("LEGACY_V3_CHANGED_AFTER_COMMIT"));
  assert.deepEqual(boot.runtime.sandboxEntities, committedBefore.runtime.sandboxEntities);
});

test("GATE-B-02 custom/preset timestamp records survive migration and restart as sandbox", async () => {
  const custom = {
    id: "heir-soren-1700000000000",
    name: "Soren Nur Saren",
    title: "Local preset",
    category: "heir_child",
    createdAt: 1700000000000,
    anchoredAt: "2026-10-07T00:00:00Z",
    metrics: { trust: 61, passion: 50, suspicion: 13 },
  };
  const storage = new MemoryStorage({ [STORAGE_KEYS.legacyV3]: JSON.stringify(legacyState([custom])) });
  await migrateV3ToV4({ storage, builtInIds, registry, registryCache: approvedCache() });
  const boot = await bootPalaceAuthority({ storage, builtInIds, liveRegistryBytes: registryBytes, liveRegistryText: registryText, manifest });
  const found = boot.runtime.sandboxEntities.find((x) => x.localId === custom.id);
  assert.ok(found);
  assert.equal(found.record.createdAt, custom.createdAt);
  assert.equal(found.record.anchoredAt, custom.anchoredAt);
  assert.equal(found.linkedEntityKey, null);
});

test("GATE-B-03 canonical-name collision never auto-links sandbox record", async () => {
  const named = registry.entities.find((e) => e.canonical_name);
  const custom = { id: "custom-collision", name: named.canonical_name, createdAt: 123 };
  const storage = new MemoryStorage({ [STORAGE_KEYS.legacyV3]: JSON.stringify(legacyState([custom])) });
  const boot = await bootPalaceAuthority({ storage, builtInIds, liveRegistryBytes: registryBytes, liveRegistryText: registryText, manifest });
  const found = boot.runtime.sandboxEntities.find((x) => x.localId === custom.id);
  assert.equal(found.linkedEntityKey, null);
  assert.equal(found.collision, "POSSIBLE_CANONICAL_NAME_COLLISION");
});

test("GATE-B-04 superseded cache cannot regain authority", async () => {
  const newer = cloneJson(manifest);
  newer.snapshots[0].lifecycle = "SUPERSEDED";
  newer.snapshots.push({
    authorityDomain: AUTHORITY_DOMAIN,
    snapshotId: "R5-CURRENT",
    registrySha256: "b".repeat(64),
    approvalEpoch: 2,
    lifecycle: "CURRENT",
  });
  const result = await assessCachedSnapshot(approvedCache(), newer);
  assert.equal(result.mode, "RUNTIME_ONLY");
});

test("GATE-B-05 old client -> new REGISTRY_V4 server: legacy route is denied", () => {
  const result = legacyChatAdmissionRoute("REGISTRY_V4");
  assert.equal(result.executed, false);
  assert.ok([410, 426].includes(result.status));
});

test("GATE-B-06 new client -> old server: missing v4 handshake becomes RUNTIME_ONLY with no legacy fallback", async () => {
  const result = await negotiateV4Authority({
    fetcher: async (url) => ({ ok: false, status: 404, json: async () => ({ legacyOnly: true, url }) }),
    manifest,
    registryMode: "LIVE_APPROVED",
  });
  assert.equal(result.mode, "RUNTIME_ONLY");
  assert.equal(result.authority, null);
});

test("GATE-B-07 handshake-new -> request-old/current mismatch is rejected on request", () => {
  const handshake = authorityHandshakeRoute({ manifest, sharedActivationMode: "REGISTRY_V4", serverBuildId: "new" });
  assert.equal(handshake.status, 200);
  const result = v4ChatAdmissionRoute({
    request: {
      authority: authorityContext({ approvalEpoch: 999 }),
      runtime: { chamberId: "assembly" },
    },
    manifest,
    sharedActivationMode: "REGISTRY_V4",
  });
  assert.equal(result.executed, false);
  assert.equal(result.status, 409);
});

test("GATE-B-08 mixed server pool rejects legacy binary from v4 authority pool", () => {
  assert.throws(() => validateV4UpstreamPool([
    { id: "v4", protocol: "AC-AUTH/1" },
    { id: "legacy", protocol: "LEGACY_V3" },
  ]));
});

test("GATE-B-09 stale gateway epoch fails closed", () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 12, mode: "LEGACY_OPEN" };
  const result = gatewayAdmit({
    routeFamily: "LEGACY_CHAT",
    state,
    capability: capability(12, "LEGACY_OPEN", "LEGACY_CHAT"),
    capabilityVerifiedByControlPlane: true,
    highestObservedCutoverEpoch: 14,
    now: 100,
    controlPlaneReachable: true,
  });
  assert.equal(result.allow, false);
  assert.equal(result.reason, "CONTROL_PLANE_EPOCH_REGRESSION");
});

test("GATE-B-10 control-plane partition fails closed", () => {
  const result = gatewayAdmit({
    routeFamily: "V4_CHAT",
    state: null,
    capability: null,
    capabilityVerifiedByControlPlane: false,
    highestObservedCutoverEpoch: 14,
    now: 100,
    controlPlaneReachable: false,
  });
  assert.equal(result.allow, false);
  assert.equal(result.reason, "CONTROL_PLANE_UNAVAILABLE");
});

test("GATE-B-11 uncertain clock prevents REGISTRY_V4 activation", () => {
  const lock = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 13, mode: "CUTOVER_LOCK" };
  assert.equal(canActivateRegistryV4({
    state: lock,
    legacyCapabilities: [capability(12, "LEGACY_OPEN", "LEGACY_CHAT", { expiresAt: 99 })],
    now: 100,
    clockReliable: false,
  }), false);
});

test("GATE-B-12 CUTOVER_LOCK is zero-authority", () => {
  for (const route of ["LEGACY_CHAT","V4_AUTHORITY","V4_CHAT"]) {
    assert.equal(routePermittedByMode("CUTOVER_LOCK", route), false);
  }
});

test("GATE-B-13 route-family capability mismatch is rejected", () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 14, mode: "REGISTRY_V4" };
  const result = gatewayAdmit({
    routeFamily: "V4_CHAT",
    state,
    capability: capability(14, "REGISTRY_V4", "V4_AUTHORITY"),
    capabilityVerifiedByControlPlane: true,
    highestObservedCutoverEpoch: 14,
    now: 100,
    controlPlaneReachable: true,
  });
  assert.equal(result.allow, false);
  assert.equal(result.reason, "CAPABILITY_ROUTE_FAMILY_MISMATCH");
});

test("GATE-B-14 authority-domain mismatch is rejected at runtime boundary", () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 14, mode: "REGISTRY_V4" };
  const result = validateExecutionCapability(
    { ...capability(14, "REGISTRY_V4", "V4_CHAT"), authorityDomain: "wrong-domain" },
    { verifiedByControlPlane: true, currentState: state, highestObservedCutoverEpoch: 14, now: 100, clockReliable: true },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "CAPABILITY_AUTHORITY_DOMAIN_MISMATCH");
});

test("GATE-B-15 direct-origin authority bypass remains denied by policy", () => {
  validateGatewayPolicy(gatewayPolicy);
  assert.equal(gatewayPolicy.directOriginAccess, "DENY");
});

test("GATE-B-16 no cutover mode permits legacy and v4 chat simultaneously", () => {
  for (const mode of ["LEGACY_OPEN","CUTOVER_LOCK","REGISTRY_V4"]) {
    assert.equal(routePermittedByMode(mode, "LEGACY_CHAT") && routePermittedByMode(mode, "V4_CHAT"), false);
  }
  const legacy = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 1, mode: "LEGACY_OPEN" };
  const lock = nextCutoverState(legacy, "CUTOVER_LOCK");
  const v4 = nextCutoverState(lock, "REGISTRY_V4");
  assert.equal(legacy.cutoverEpoch < lock.cutoverEpoch && lock.cutoverEpoch < v4.cutoverEpoch, true);
});

test("GATE-B-17 live App uses v4-only authority path and never writes v3", () => {
  assert.match(appSource, /V4_ENDPOINTS\.chat/);
  assert.match(appSource, /loadBundledAuthorityInputs/);
  assert.match(appSource, /negotiateV4Authority/);
  assert.equal(appSource.includes('fetch("/api/game/chat"'), false);
  assert.equal(appSource.includes('localStorage.setItem("anchor_court_game_state_v3"'), false);
  assert.match(appSource, /RUNTIME_ONLY/);
});

test("GATE-B-18 live server wires v4 endpoints, gates legacy, and contains no shared legacy structural fallback", () => {
  assert.match(serverSource, /app\.get\("\/api\/v4\/authority"/);
  assert.match(serverSource, /app\.post\("\/api\/v4\/game\/chat"/);
  assert.match(serverSource, /legacyChatAdmissionRoute\(sharedCutoverMode\)/);
  assert.equal(serverSource.includes("const activeScroll = scrollText || LORE_SCROLL"), false);
  assert.match(serverSource, /sharedCutoverMode/);
});

test("GATE-B-FIXTURE-GUARD exact RC4 bytes unchanged after integration suite", () => {
  assert.equal(sha(fs.readFileSync(registryPath)), EXPECTED_REGISTRY_SHA);
  assert.equal(sha(fs.readFileSync(balloonPath)), EXPECTED_BALLOON_SHA);
});
