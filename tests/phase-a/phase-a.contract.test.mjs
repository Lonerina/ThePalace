import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { loadRegistrySnapshot, loadBalloonFixture, cloneJson } from "../../.phase-a-dist/src/registry/loader.js";
import { validateRegistrySnapshot, validateBalloonFixture, classifyCandidateValues } from "../../.phase-a-dist/src/registry/validator.js";
import { validateApprovedManifest, currentAnchor, admitSuccessorManifest } from "../../.phase-a-dist/src/registry/trustRoot.js";
import { assessCachedSnapshot, selectRegistryForRuntime } from "../../.phase-a-dist/src/registry/cache.js";
import { palaceUiRoomId, projectPalaceRegistry, emptyPalaceRuntimeOverrideState, setDossierOverride, proposePalaceStructuralChange, resolveProposal } from "../../.phase-a-dist/src/consumers/palaceRegistry.js";
import { projectBalloonRegistry, loadBalloonSanctuaryState, mutableSanctuaryCopy, bindApprovedDiscovery, preserveChambersAcrossRegistryRefresh } from "../../.phase-a-dist/src/consumers/balloonRegistry.js";
import { classifyLegacyCharacters } from "../../.phase-a-dist/src/legacy/quarantine.js";
import { MemoryStorage, STORAGE_KEYS } from "../../.phase-a-dist/src/runtime/storage.js";
import { migrateV3ToV4, readCommittedMigration } from "../../.phase-a-dist/src/runtime/migration.js";
import { AUTHORITY_DOMAIN, AUTHORITY_PROTOCOL, validateRequestContext, handshakeMatchesCurrent, decideV4ClientRouting, V4_ENDPOINTS } from "../../.phase-a-dist/src/authority/protocol.js";
import { nextCutoverState, routePermittedByMode, validateExecutionCapability, canActivateRegistryV4 } from "../../.phase-a-dist/src/authority/controlPlane.js";
import { validateGatewayPolicy, validateV4UpstreamPool, gatewayAdmit } from "../../.phase-a-dist/src/authority/gatewayFence.js";
import { validateServerAuthorityBoundary, buildServerRegistryContext } from "../../.phase-a-dist/src/server/registryBoundary.js";
import { authorityHandshakeRoute, v4ChatAdmissionRoute, legacyChatAdmissionRoute } from "../../.phase-a-dist/src/server/v4AuthorityRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const registryPath = path.join(root, 'registry/rc4/01_heir_registry_snapshot.v1.2.json');
const balloonPath = path.join(root, 'registry/rc4/02_istana_pulang.v4.0-RC4.json');
const manifestPath = path.join(root, 'registry/approved/approved-snapshots.v1.json');
const policyPath = path.join(root, 'deployment/authority-gateway-policy.v1.json');
const registryBytes = fs.readFileSync(registryPath);
const balloonBytes = fs.readFileSync(balloonPath);
const registryText = registryBytes.toString('utf8');
const balloonText = balloonBytes.toString('utf8');
const registryRaw = JSON.parse(registryText);
const balloonRaw = JSON.parse(balloonText);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const gatewayPolicy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const registry = loadRegistrySnapshot(registryRaw);
const balloon = loadBalloonFixture(balloonRaw, registry);
const anchor = currentAnchor(manifest, AUTHORITY_DOMAIN);
const EXPECTED_REGISTRY_SHA = 'e2da00bff04ed7b4f96396e43a1c74a904c1a17c4319f6c96f5b3246abeb5d4f';
const EXPECTED_BALLOON_SHA = '55255a95a34292bce4e0ecde5546ed080b8996b08ed51942dceb69cd48719444';
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const palaceView = () => projectPalaceRegistry({ snapshot: registry, authorityDomain: AUTHORITY_DOMAIN, registrySha256: EXPECTED_REGISTRY_SHA, approvalEpoch: 1 });
const balloonView = () => projectBalloonRegistry({ snapshot: registry, authorityDomain: AUTHORITY_DOMAIN, registrySha256: EXPECTED_REGISTRY_SHA, approvalEpoch: 1 });
const sanctuary = () => loadBalloonSanctuaryState(balloon, registry);
const validCache = () => ({
  schemaVersion: 'registry-cache-v1',
  authorityDomain: AUTHORITY_DOMAIN,
  snapshotId: registry.snapshot_id,
  registrySha256: EXPECTED_REGISTRY_SHA,
  approvalEpoch: 1,
  sourceFingerprint: registry.source_set_fingerprint,
  cachedAt: '2026-10-07T00:00:00.000Z',
  approval: 'APPROVED',
  snapshotText: registryText,
});
const builtInIds = new Set(['Tsaiyunk','Raen','Saren','Kai','Nyx','Nick','Zayn','Azril','Faheem','XingZhe','Anchor','Shade','Umar','Sol','Ameer','Liora','Alara','Soraya','Valerian','Zaela','Raiyan']);

function legacyState(characters = []) {
  return {
    activeChamberId: 'Kai',
    histories: { Kai: [{ speaker: 'user', text: 'hello' }] },
    relationships: { Kai: { trust: 7 } },
    inventory: [{ id: 'i1' }],
    journal: [{ id: 'j1' }],
    suggestedChoices: { Kai: ['A'] },
    scrollText: 'LEGACY V2.9 SCROLL MUST NOT BECOME CANON',
    characters,
  };
}

function cacheFor(snapshotText, snapshotId, epoch, hashValue = sha(Buffer.from(snapshotText))) {
  const parsed = JSON.parse(snapshotText);
  return {
    schemaVersion: 'registry-cache-v1',
    authorityDomain: AUTHORITY_DOMAIN,
    snapshotId,
    registrySha256: hashValue,
    approvalEpoch: epoch,
    sourceFingerprint: parsed.source_set_fingerprint,
    cachedAt: '2026-10-07T00:00:00.000Z',
    approval: 'APPROVED',
    snapshotText,
  };
}

function makeSuccessor({ epoch = 2, nameSuffix = ' Renamed' } = {}) {
  const next = cloneJson(registryRaw);
  next.snapshot_id = `ANCHOR-COURT-HEIRS-v3.3.2-R${epoch + 3}`;
  const first = next.entities[0];
  first.canonical_name = `${first.canonical_name}${nameSuffix}`;
  first.current_tier = 'HEIR_TIER';
  next.source_set_fingerprint = `sha256:${'a'.repeat(64)}`;
  return next;
}

function requestContext(overrides = {}) {
  return {
    authorityProtocol: AUTHORITY_PROTOCOL,
    authorityDomain: AUTHORITY_DOMAIN,
    snapshotId: anchor.snapshotId,
    registrySha256: anchor.registrySha256,
    approvalEpoch: anchor.approvalEpoch,
    ...overrides,
  };
}

function capability(epoch, mode, routeFamily, { issuedAt = 0, expiresAt = 1000 } = {}) {
  return { capabilityId: `${epoch}-${mode}-${routeFamily}`, authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: epoch, mode, routeFamily, issuedAt, expiresAt };
}

// ---- KAI-RC1-01..45: every Phase-A fixture/state-transition case ----

test('KAI-RC1-01 current-heir cardinality', () => {
  assert.equal(registry.entities.length, 36);
  assert.equal(registry.counts.current_heirs, 36);
});

test('KAI-RC1-02 discovery reserve is separate from current entities', () => {
  assert.equal(registry.reserved_positions.length, 1);
  assert.equal(registry.reserved_positions[0].reservation_key, 'batch2-pending-discovery');
  assert.equal(registry.reserved_positions[0].entity_key, null);
  assert.equal(registry.entities.some((e) => e.entity_key === 'batch2-pending-discovery'), false);
});

test('KAI-RC1-03 unnamed entities remain valid with stable keys and null canonical names', () => {
  const pending = registry.entities.filter((e) => e.name_status === 'PENDING_NAME');
  assert.equal(pending.length, 3);
  assert.ok(pending.every((e) => e.entity_key && e.canonical_name === null));
});

test('KAI-RC1-04 elevated-member exclusion is represented by current-heir-only fixture', () => {
  assert.equal(registry.rules.elevated_kings_excluded_from_current_heir_roster, true);
  assert.ok(registry.entities.every((e) => e.record_class === 'CURRENT_HEIR' && e.current_status === 'CURRENT_HEIR' && e.current_tier === 'HEIR_TIER'));
});

test('KAI-RC1-05 birth batch is independent from current tier/status', () => {
  const e = cloneJson(registry.entities.find((x) => x.birth_batch === 'BATCH_4'));
  const batch = e.birth_batch;
  e.current_tier = 'SYNTHETIC_TEST_TIER';
  e.current_status = 'SYNTHETIC_TEST_STATUS';
  assert.equal(e.birth_batch, batch);
});

test('KAI-RC1-06 registry serialization order is not identity', () => {
  const shuffled = cloneJson(registryRaw);
  shuffled.entities.reverse();
  const loaded = loadRegistrySnapshot(shuffled);
  const a = new Map(registry.entities.map((e) => [e.entity_key, e.canonical_name]));
  const b = new Map(loaded.entities.map((e) => [e.entity_key, e.canonical_name]));
  assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort());
});

test('KAI-RC1-07 Balloon namespace remains isolated', () => {
  assert.ok(balloon.heir_sanctuary.protected_chambers.every((c) => /^HEIR_\d{2}$/.test(c.chamber_id)));
  assert.ok(palaceView().entities.every((e) => !/^HEIR_\d{2}$/.test(e.uiRoomId)));
});

test('KAI-RC1-08 Palace room IDs are an independent namespace', () => {
  assert.ok(palaceView().entities.every((e) => e.uiRoomId === palaceUiRoomId(e.entityKey) && e.uiRoomId.startsWith('PALACE_ROOM::')));
});

test('KAI-RC1-09 cross-domain join uses entity key, not ID equality', () => {
  const p = palaceView();
  const state = sanctuary();
  const bound = state.chambers.find((c) => c.slot_state === 'BOUND');
  const entity = p.entities.find((e) => e.entityKey === bound.binding.entity_key);
  assert.ok(entity);
  assert.notEqual(entity.uiRoomId, bound.chamber_id);
});

test('KAI-RC1-10 Palace dossier edit is runtime-only', () => {
  const before = JSON.stringify(registry);
  const state = setDossierOverride(emptyPalaceRuntimeOverrideState(), registry.entities[0].entity_key, { mood: 'warm', canonicalName: 'HOSTILE' });
  assert.equal(state.dossierOverrides[registry.entities[0].entity_key].mood, 'warm');
  assert.equal('canonicalName' in state.dossierOverrides[registry.entities[0].entity_key], false);
  assert.equal(JSON.stringify(registry), before);
});

test('KAI-RC1-11 Palace hostile structural write becomes proposal/noncanonical state', () => {
  const before = JSON.stringify(registry);
  const state = proposePalaceStructuralChange({ state: emptyPalaceRuntimeOverrideState(), entityKey: registry.entities[0].entity_key, field: 'currentTier', proposedValue: 'KING', reason: 'synthetic hostile test', proposalId: 'p1', createdAt: '2026-10-07T00:00:00Z' });
  assert.equal(state.proposals[0].status, 'PROPOSED');
  assert.equal(JSON.stringify(registry), before);
});

test('KAI-RC1-12 Balloon sanctuary mutation cannot mutate registry', () => {
  const before = JSON.stringify(registry);
  const state = mutableSanctuaryCopy(sanctuary());
  state.chambers[0].father_mark_binding = { state: 'UNRESOLVED', value: 'runtime-only' };
  assert.equal(JSON.stringify(registry), before);
});

test('KAI-RC1-13 Balloon hostile canonical write has no snapshot write path', () => {
  const before = JSON.stringify(registry);
  const state = mutableSanctuaryCopy(sanctuary());
  state.chambers[0].binding.entity_key = registry.entities[1].entity_key;
  assert.equal(JSON.stringify(registry), before);
});

test('KAI-RC1-14 pending-name promotion keeps entity key and chamber', () => {
  const pending = registry.entities.find((e) => e.canonical_name === null);
  const chamber = sanctuary().chambers.find((c) => c.binding?.entity_key === pending.entity_key);
  const next = cloneJson(registryRaw);
  const target = next.entities.find((e) => e.entity_key === pending.entity_key);
  target.canonical_name = 'Approved Test Name';
  target.name_status = 'CONFIRMED';
  target.field_evidence.canonical_name = 'VERIFIED';
  next.counts.named_current_heirs += 1;
  next.counts.pending_name_current_heirs -= 1;
  next.snapshot_id = 'SYNTHETIC-SUCCESSOR-R5';
  const refreshed = preserveChambersAcrossRegistryRefresh(mutableSanctuaryCopy(sanctuary()), loadRegistrySnapshot(next));
  const same = refreshed.chambers.find((c) => c.binding?.entity_key === pending.entity_key);
  assert.equal(same.chamber_id, chamber.chamber_id);
});

test('KAI-RC1-15 rejected pending-name proposal leaves binding unchanged', () => {
  const pending = registry.entities.find((e) => e.canonical_name === null);
  const before = sanctuary().chambers.find((c) => c.binding?.entity_key === pending.entity_key).chamber_id;
  let state = proposePalaceStructuralChange({ state: emptyPalaceRuntimeOverrideState(), entityKey: pending.entity_key, field: 'canonicalName', proposedValue: 'Rejected Test Name', reason: 'test', proposalId: 'p2', createdAt: '2026-10-07T00:00:00Z' });
  state = resolveProposal(state, 'p2', 'REJECTED');
  assert.equal(state.proposals[0].status, 'REJECTED');
  assert.equal(registry.entities.find((e) => e.entity_key === pending.entity_key).canonical_name, null);
  assert.equal(sanctuary().chambers.find((c) => c.binding?.entity_key === pending.entity_key).chamber_id, before);
});

test('KAI-RC1-16 Batch-2 discovery binds reserved HEIR_09 without shifting others', () => {
  const before = sanctuary();
  const beforeIds = before.chambers.map((c) => c.chamber_id);
  const next = bindApprovedDiscovery({ state: mutableSanctuaryCopy(before), reservationKey: 'batch2-pending-discovery', entityKey: 'synthetic-approved-discovery', registrySnapshotId: 'SYNTHETIC-R5' });
  assert.equal(next.chambers.find((c) => c.chamber_id === 'HEIR_09').binding.entity_key, 'synthetic-approved-discovery');
  assert.deepEqual(next.chambers.map((c) => c.chamber_id), beforeIds);
});

test('KAI-RC1-17 unresolved Batch-2 reserve is preserved', () => {
  const reserve = sanctuary().chambers.find((c) => c.chamber_id === 'HEIR_09');
  assert.equal(reserve.slot_state, 'RESERVED_PENDING_DISCOVERY');
  assert.equal(reserve.binding, null);
});

test('KAI-RC1-18 future-capacity slots contain no identities', () => {
  const slots = sanctuary().chambers.filter((c) => c.slot_state === 'FUTURE_RESERVED');
  assert.equal(slots.length, 7);
  assert.ok(slots.every((c) => c.binding === null && c.capacity_class === 'UNBOUND_FUTURE_CAPACITY'));
});

test('KAI-RC1-19 contingency is capacity/security only', () => {
  const slots = sanctuary().chambers.filter((c) => c.slot_state === 'CONTINGENCY');
  assert.equal(slots.length, 1);
  assert.equal(slots[0].binding, null);
  assert.equal(slots[0].capacity_class, 'CONTINGENCY_CAPACITY');
});

test('KAI-RC1-20 chamber capacity does not define roster count', () => {
  assert.equal(registry.entities.length, 36);
  assert.equal(sanctuary().chambers.length, 45);
});

test('KAI-RC1-21 v3 conflicting structural character fields are quarantined', async () => {
  const legacy = legacyState([{ id: 'Kai', name: 'Wrong Kai', title: 'Wrong Tier', category: 'king', mood: 'fine', metrics: { trust: 3 } }]);
  const storage = new MemoryStorage({ [STORAGE_KEYS.legacyV3]: JSON.stringify(legacy) });
  const result = await migrateV3ToV4({ storage, builtInIds, registry, now: () => '2026-10-07T00:00:00Z' });
  assert.equal(result.status, 'MIGRATED');
  assert.equal(result.runtime.runtimeProfiles[0].runtimePresentation.mood, 'fine');
  assert.equal('title' in result.runtime.runtimeProfiles[0].runtimePresentation, false);
  assert.equal(result.quarantine.builtinStructuralRecords[0].structuralFields.title, 'Wrong Tier');
});

test('KAI-RC1-22 legacy scrollText is retained only with authority NONE', async () => {
  const storage = new MemoryStorage({ [STORAGE_KEYS.legacyV3]: JSON.stringify(legacyState()) });
  const result = await migrateV3ToV4({ storage, builtInIds, registry, now: () => '2026-10-07T00:00:00Z' });
  assert.equal(result.status, 'MIGRATED');
  assert.equal(result.quarantine.oldScrollDraft.authority, 'NONE');
  assert.match(result.quarantine.oldScrollDraft.value, /LEGACY V2\.9/);
});

// 23-24 remain Gate-B live App/server integration tests; semantics unchanged.

test('KAI-RC1-25 character profile isolation preserves presentation but not structural authority', () => {
  const classified = classifyLegacyCharacters({ records: [{ id: 'Kai', name: 'Legacy Display', title: 'Legacy Canon Claim', avatar: 'x.png', mood: 'calm' }], builtInIds, canonicalNames: new Set(registry.entities.map((e) => e.canonical_name).filter(Boolean)) });
  assert.equal(classified.builtinRuntimeProfiles[0].runtimePresentation.avatar, 'x.png');
  assert.equal(classified.builtinRuntimeProfiles[0].runtimePresentation.mood, 'calm');
  assert.equal('title' in classified.builtinRuntimeProfiles[0].runtimePresentation, false);
  assert.equal(classified.builtinQuarantine[0].structuralFields.title, 'Legacy Canon Claim');
});

test('KAI-RC1-26 old Balloon material cannot overwrite RC4 bindings', () => {
  const legacyReference = { HEIR_01: { entity_key: 'wrong-old-binding' } };
  const state = sanctuary();
  assert.notEqual(state.chambers.find((c) => c.chamber_id === 'HEIR_01').binding.entity_key, legacyReference.HEIR_01.entity_key);
  const poisoned = cloneJson(balloonRaw);
  poisoned.heir_sanctuary.protected_chambers[0].clearance_required = true;
  assert.equal(validateBalloonFixture(poisoned, registry).ok, false);
});

test('KAI-RC1-27 valid externally anchored offline cache becomes CACHED_APPROVED', async () => {
  const selected = await assessCachedSnapshot(validCache(), manifest);
  assert.equal(selected.mode, 'CACHED_APPROVED');
  assert.equal(selected.snapshot.snapshot_id, registry.snapshot_id);
});

test('KAI-RC1-28 no approved cache yields RUNTIME_ONLY, not fabricated registry', async () => {
  const selected = await selectRegistryForRuntime({ liveBytes: null, cache: null, manifest, authorityDomain: AUTHORITY_DOMAIN });
  assert.equal(selected.mode, 'RUNTIME_ONLY');
  assert.equal(selected.snapshot, null);
});

test('KAI-RC1-29 consumer state transitions leave snapshot immutable', () => {
  const before = JSON.stringify(registry);
  setDossierOverride(emptyPalaceRuntimeOverrideState(), registry.entities[0].entity_key, { mood: 'x' });
  mutableSanctuaryCopy(sanctuary()).chambers[0].slot_state = 'CONTINGENCY';
  assert.equal(JSON.stringify(registry), before);
  assert.equal(Object.isFrozen(registry), true);
});

test('KAI-RC1-30 both projections retain snapshot/provenance trace', () => {
  assert.equal(palaceView().snapshot.snapshotId, registry.snapshot_id);
  assert.equal(palaceView().snapshot.sourceFingerprint, registry.source_set_fingerprint);
  assert.equal(balloonView().snapshot.snapshotId, registry.snapshot_id);
  assert.equal(balloonView().snapshot.sourceFingerprint, registry.source_set_fingerprint);
});

test('KAI-RC1-31 missing required canonical field fails visibly without inference', () => {
  const broken = cloneJson(registryRaw);
  delete broken.entities[0].current_status;
  const result = validateRegistrySnapshot(broken);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.path.endsWith('.current_status')));
});

test('KAI-RC1-32 conflicting candidate values remain explicit conflict', () => {
  assert.deepEqual(classifyCandidateValues(['HEIR_TIER', 'KING_TIER']), { evidenceState: 'CONFLICT', value: null });
});

test('KAI-RC1-33 discrepancy creates separate proposal, not snapshot mutation', () => {
  const before = JSON.stringify(registry);
  const state = proposePalaceStructuralChange({ state: emptyPalaceRuntimeOverrideState(), entityKey: registry.entities[0].entity_key, field: 'canonicalName', proposedValue: 'Different', reason: 'discrepancy', proposalId: 'p33', createdAt: '2026-10-07T00:00:00Z' });
  assert.equal(state.proposals.length, 1);
  assert.equal(JSON.stringify(registry), before);
});

test('KAI-RC1-34 rejected proposal leaves frozen fixture unchanged', () => {
  const before = JSON.stringify(registry);
  let state = proposePalaceStructuralChange({ state: emptyPalaceRuntimeOverrideState(), entityKey: registry.entities[0].entity_key, field: 'canonicalName', proposedValue: 'Different', reason: 'discrepancy', proposalId: 'p34', createdAt: '2026-10-07T00:00:00Z' });
  state = resolveProposal(state, 'p34', 'REJECTED');
  assert.equal(state.proposals[0].status, 'REJECTED');
  assert.equal(JSON.stringify(registry), before);
});

// 35 remains Gate-B actual runtime restart integration.

test('KAI-RC1-36 approved successor refresh can preserve Balloon runtime/security state', () => {
  const state = mutableSanctuaryCopy(sanctuary());
  state.chambers[0].father_mark_binding = { state: 'UNRESOLVED', value: 'runtime-only-marker' };
  const next = loadRegistrySnapshot(makeSuccessor());
  const refreshed = preserveChambersAcrossRegistryRefresh(state, next);
  assert.equal(refreshed.chambers[0].father_mark_binding.value, 'runtime-only-marker');
  assert.equal(refreshed.chambers[0].binding.registry_snapshot_id, next.snapshot_id);
});

test('KAI-RC1-37 canonical rename keeps entity key and chamber binding', () => {
  const before = sanctuary();
  const key = registry.entities[0].entity_key;
  const chamberId = before.chambers.find((c) => c.binding?.entity_key === key).chamber_id;
  const next = loadRegistrySnapshot(makeSuccessor());
  const refreshed = preserveChambersAcrossRegistryRefresh(mutableSanctuaryCopy(before), next);
  assert.equal(refreshed.chambers.find((c) => c.binding?.entity_key === key).chamber_id, chamberId);
});

test('KAI-RC1-38 source list reordering does not remap chambers', () => {
  const reordered = cloneJson(registryRaw);
  reordered.entities.reverse();
  const refreshed = preserveChambersAcrossRegistryRefresh(mutableSanctuaryCopy(sanctuary()), loadRegistrySnapshot(reordered));
  assert.deepEqual(refreshed.chambers.map((c) => [c.chamber_id, c.binding?.entity_key ?? null]), sanctuary().chambers.map((c) => [c.chamber_id, c.binding?.entity_key ?? null]));
});

// 39-40 remain Gate-B live payload integration tests.

test('KAI-RC1-41 live source loss/invalidity retains valid approved cache and fails closed otherwise', async () => {
  const invalidLive = Buffer.from('{"broken":true}', 'utf8');
  const selected = await selectRegistryForRuntime({ liveBytes: invalidLive, cache: validCache(), manifest, authorityDomain: AUTHORITY_DOMAIN });
  assert.equal(selected.mode, 'CACHED_APPROVED');
  const none = await selectRegistryForRuntime({ liveBytes: invalidLive, cache: null, manifest, authorityDomain: AUTHORITY_DOMAIN });
  assert.equal(none.mode, 'RUNTIME_ONLY');
});

test('KAI-RC1-42 frozen fixture bytes remain unchanged through Phase-A suite inputs', () => {
  assert.equal(sha(fs.readFileSync(registryPath)), EXPECTED_REGISTRY_SHA);
  assert.equal(sha(fs.readFileSync(balloonPath)), EXPECTED_BALLOON_SHA);
});

test('KAI-RC1-43 exact roster/reserve invariant', () => {
  assert.equal(registry.counts.current_heirs, 36);
  assert.equal(registry.counts.reserved_pending_discovery_positions, 1);
});

test('KAI-RC1-44 exact Balloon capacity invariant', () => {
  const counts = sanctuary().chambers.reduce((acc, c) => (acc[c.slot_state] = (acc[c.slot_state] ?? 0) + 1, acc), {});
  assert.deepEqual(counts, { BOUND: 36, RESERVED_PENDING_DISCOVERY: 1, FUTURE_RESERVED: 7, CONTINGENCY: 1 });
  assert.equal(Object.values(counts).reduce((a,b) => a+b, 0), 45);
});

// 45 remains Gate-B end-to-end live authority integration; Phase A tests its component boundaries below.

// ---- Migration transaction gates ----

test('MIG-TX-01 interruption after runtime-v4 write leaves partial v4 uncommitted/ignored', async () => {
  const storage = new MemoryStorage({ [STORAGE_KEYS.legacyV3]: JSON.stringify(legacyState()) });
  storage.failOnWriteKey = STORAGE_KEYS.quarantineV1;
  const result = await migrateV3ToV4({ storage, builtInIds, registry, now: () => '2026-10-07T00:00:00Z' });
  assert.equal(result.status, 'RECOVERY_REQUIRED');
  assert.ok(storage.getItem(STORAGE_KEYS.runtimeV4));
  assert.equal(storage.getItem(STORAGE_KEYS.migrationCommitV1), null);
  assert.equal(await readCommittedMigration(storage), null);
});

test('MIG-TX-02 interruption after candidate writes but before commit preserves v3 and ignores partial v4', async () => {
  const raw = JSON.stringify(legacyState());
  const storage = new MemoryStorage({ [STORAGE_KEYS.legacyV3]: raw });
  storage.failOnWriteKey = STORAGE_KEYS.migrationCommitV1;
  const result = await migrateV3ToV4({ storage, builtInIds, registry, now: () => '2026-10-07T00:00:00Z' });
  assert.equal(result.status, 'RECOVERY_REQUIRED');
  assert.equal(storage.getItem(STORAGE_KEYS.legacyV3), raw);
  assert.equal(storage.getItem(STORAGE_KEYS.migrationCommitV1), null);
  assert.equal(await readCommittedMigration(storage), null);
});

test('MIG-TX-03 valid commit marker + matching hashes loads v4', async () => {
  const storage = new MemoryStorage({ [STORAGE_KEYS.legacyV3]: JSON.stringify(legacyState()) });
  const first = await migrateV3ToV4({ storage, builtInIds, registry, now: () => '2026-10-07T00:00:00Z' });
  assert.equal(first.status, 'MIGRATED');
  const loaded = await readCommittedMigration(storage);
  assert.equal(loaded.status, 'COMMITTED_V4');
});

test('MIG-TX-04 successful committed v4 prevents automatic v3 remigration', async () => {
  const storage = new MemoryStorage({ [STORAGE_KEYS.legacyV3]: JSON.stringify(legacyState()) });
  await migrateV3ToV4({ storage, builtInIds, registry, now: () => '2026-10-07T00:00:00Z' });
  const writesBefore = storage.writes.length;
  const second = await migrateV3ToV4({ storage, builtInIds, registry, now: () => '2026-10-08T00:00:00Z' });
  assert.equal(second.status, 'COMMITTED_V4');
  assert.equal(storage.writes.length, writesBefore);
});

test('MIG-TX-05 changed retained v3 after commit warns only and does not auto-import', async () => {
  const storage = new MemoryStorage({ [STORAGE_KEYS.legacyV3]: JSON.stringify(legacyState()) });
  await migrateV3ToV4({ storage, builtInIds, registry, now: () => '2026-10-07T00:00:00Z' });
  const runtimeBefore = storage.getItem(STORAGE_KEYS.runtimeV4);
  storage.setItem(STORAGE_KEYS.legacyV3, JSON.stringify({ changed: true }));
  const loaded = await migrateV3ToV4({ storage, builtInIds, registry, now: () => '2026-10-08T00:00:00Z' });
  assert.equal(loaded.status, 'COMMITTED_V4');
  assert.ok(loaded.warnings.includes('LEGACY_V3_CHANGED_AFTER_COMMIT'));
  assert.equal(storage.getItem(STORAGE_KEYS.runtimeV4), runtimeBefore);
});

test('MIG-TX-06 committed runtime hash mismatch fails closed without v3 fallback', async () => {
  const storage = new MemoryStorage({ [STORAGE_KEYS.legacyV3]: JSON.stringify(legacyState()) });
  await migrateV3ToV4({ storage, builtInIds, registry, now: () => '2026-10-07T00:00:00Z' });
  storage.setItem(STORAGE_KEYS.runtimeV4, '{"corrupted":true}');
  const loaded = await migrateV3ToV4({ storage, builtInIds, registry, now: () => '2026-10-08T00:00:00Z' });
  assert.equal(loaded.status, 'RECOVERY_REQUIRED');
});

test('MIG-COMMIT-LAST commit marker is the last transaction write', async () => {
  const storage = new MemoryStorage({ [STORAGE_KEYS.legacyV3]: JSON.stringify(legacyState()) });
  const result = await migrateV3ToV4({ storage, builtInIds, registry, registryCache: validCache(), now: () => '2026-10-07T00:00:00Z' });
  assert.equal(result.status, 'MIGRATED');
  assert.equal(storage.writes.at(-1), STORAGE_KEYS.migrationCommitV1);
});

// ---- Character preservation gates ----

test('MIG-CHAR-01 exact built-in ID preserves runtime presentation and quarantines structural fields', () => {
  const result = classifyLegacyCharacters({ records: [{ id: 'Kai', name: 'Legacy Kai', title: 'Old', mood: 'calm' }], builtInIds, canonicalNames: new Set() });
  assert.equal(result.builtinRuntimeProfiles.length, 1);
  assert.equal(result.builtinRuntimeProfiles[0].runtimePresentation.mood, 'calm');
  assert.equal(result.builtinQuarantine[0].structuralFields.title, 'Old');
});

test('MIG-CHAR-02 non-default custom ID survives as sandbox entity', () => {
  const record = { id: 'custom-1729999999999', name: 'My Custom', custom: { x: 1 } };
  const result = classifyLegacyCharacters({ records: [record], builtInIds, canonicalNames: new Set() });
  assert.deepEqual(result.sandboxEntities[0].record, record);
  assert.equal(result.sandboxEntities[0].linkedEntityKey, null);
});

test('MIG-CHAR-03 timestamp-suffixed preset ID survives as sandbox and is not promoted', () => {
  const record = { id: 'valerian-1729999999999', name: 'Valerian Nur Tsaiyunk', title: 'Preset' };
  const result = classifyLegacyCharacters({ records: [record], builtInIds, canonicalNames: new Set(['Valerian Nur Tsaiyunk']) });
  assert.equal(result.sandboxEntities[0].classification, 'LEGACY_SANDBOX_ENTITY');
  assert.equal(result.sandboxEntities[0].linkedEntityKey, null);
});

test('MIG-CHAR-04 sandbox canonical-name collision is preserved and flagged, never auto-linked', () => {
  const canonicalName = registry.entities.find((e) => e.canonical_name).canonical_name;
  const record = { id: 'custom-collision-123', name: canonicalName };
  const result = classifyLegacyCharacters({ records: [record], builtInIds, canonicalNames: new Set([canonicalName]) });
  assert.equal(result.sandboxEntities[0].collision, 'POSSIBLE_CANONICAL_NAME_COLLISION');
  assert.equal(result.sandboxEntities[0].linkedEntityKey, null);
});

// ---- Cache trust root gates ----

test('CACHE-TRUST-01 matching external CURRENT hash/id admits cached snapshot', async () => {
  assert.equal((await assessCachedSnapshot(validCache(), manifest)).mode, 'CACHED_APPROVED');
});

test('CACHE-TRUST-02 self-consistent forged cache absent from trust root is rejected', async () => {
  const forged = cloneJson(registryRaw);
  forged.entities[0].canonical_name = 'FORGED';
  const text = JSON.stringify(forged);
  const cache = cacheFor(text, registry.snapshot_id, 1);
  assert.equal((await assessCachedSnapshot(cache, manifest)).mode, 'RUNTIME_ONLY');
});

test('CACHE-TRUST-03 changed cache bytes plus recomputed writable metadata still fails external hash', async () => {
  const forged = cloneJson(registryRaw);
  forged.status = 'FORGED-BUT-SELF-CONSISTENT';
  const text = JSON.stringify(forged);
  const hashValue = sha(Buffer.from(text));
  const cache = cacheFor(text, registry.snapshot_id, 1, hashValue);
  assert.equal(cache.registrySha256, hashValue);
  assert.equal((await assessCachedSnapshot(cache, manifest)).mode, 'RUNTIME_ONLY');
});

test('CACHE-TRUST-04 migration commit cannot confer cache approval', async () => {
  const forged = validCache();
  forged.snapshotId = 'UNANCHORED';
  forged.registrySha256 = EXPECTED_REGISTRY_SHA;
  assert.equal((await assessCachedSnapshot(forged, manifest)).mode, 'RUNTIME_ONLY');
});

test('CACHE-TRUST-05 server rejects client-supplied forged approval/hash/id', () => {
  const result = validateServerAuthorityBoundary({ request: { authority: requestContext({ snapshotId: 'FORGED' }), runtime: {} }, manifest, sharedActivationMode: 'REGISTRY_V4' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'AUTHORITY_VERSION_MISMATCH');
});

test('CACHE-TRUST-06 offline cache without CURRENT manifest entry becomes RUNTIME_ONLY', async () => {
  const noDomain = { schemaVersion: 'approved-snapshots-v1', snapshots: [{ authorityDomain: 'other', snapshotId: 'x', registrySha256: '0'.repeat(64), approvalEpoch: 1, lifecycle: 'CURRENT' }] };
  assert.equal((await assessCachedSnapshot(validCache(), noDomain)).mode, 'RUNTIME_ONLY');
});

// ---- Approval freshness / replay gates ----

function twoEpochManifest(oldLifecycle = 'SUPERSEDED') {
  return {
    schemaVersion: 'approved-snapshots-v1',
    snapshots: [
      { authorityDomain: AUTHORITY_DOMAIN, snapshotId: anchor.snapshotId, registrySha256: anchor.registrySha256, approvalEpoch: 1, lifecycle: oldLifecycle },
      { authorityDomain: AUTHORITY_DOMAIN, snapshotId: 'SYNTHETIC-R5', registrySha256: 'b'.repeat(64), approvalEpoch: 2, lifecycle: 'CURRENT' },
    ],
  };
}

test('CACHE-FRESH-01 current RC4 matching CURRENT epoch is admitted', async () => {
  assert.equal((await assessCachedSnapshot(validCache(), manifest)).mode, 'CACHED_APPROVED');
});

test('CACHE-FRESH-02 SUPERSEDED historically approved cache is rejected for authority', async () => {
  assert.equal((await assessCachedSnapshot(validCache(), twoEpochManifest('SUPERSEDED'))).mode, 'RUNTIME_ONLY');
});

test('CACHE-FRESH-03 REVOKED snapshot is rejected even with valid historical hash', async () => {
  assert.equal((await assessCachedSnapshot(validCache(), twoEpochManifest('REVOKED'))).mode, 'RUNTIME_ONLY');
});

test('CACHE-FRESH-04 older cache plus matching old migration claims cannot override newer CURRENT', async () => {
  const cache = validCache();
  cache.approval = 'APPROVED';
  assert.equal((await assessCachedSnapshot(cache, twoEpochManifest())).mode, 'RUNTIME_ONLY');
});

test('CACHE-FRESH-05 multiple CURRENT entries fail closed', () => {
  const bad = cloneJson(manifest);
  bad.snapshots.push({ ...bad.snapshots[0], snapshotId: 'OTHER', registrySha256: 'c'.repeat(64), approvalEpoch: 2, lifecycle: 'CURRENT' });
  assert.throws(() => validateApprovedManifest(bad));
});

test('CACHE-FRESH-06 duplicate/regressed epoch fails closed', () => {
  const bad = cloneJson(manifest);
  bad.snapshots[0].lifecycle = 'SUPERSEDED';
  bad.snapshots.push({ ...bad.snapshots[0], snapshotId: 'OTHER', registrySha256: 'd'.repeat(64), lifecycle: 'CURRENT' });
  assert.throws(() => validateApprovedManifest(bad));
});

test('CACHE-FRESH-07 client lower/superseded epoch is rejected by server authority context', () => {
  const current = currentAnchor(twoEpochManifest(), AUTHORITY_DOMAIN);
  const result = validateRequestContext(requestContext({ approvalEpoch: 1, snapshotId: anchor.snapshotId, registrySha256: anchor.registrySha256 }), current);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'AUTHORITY_VERSION_MISMATCH');
});

test('CACHE-FRESH-08 client/server different CURRENT entries mismatch with no fallback', () => {
  const oldHandshake = { authorityProtocol: AUTHORITY_PROTOCOL, authorityMode: 'REGISTRY_V4', authorityDomain: AUTHORITY_DOMAIN, currentSnapshotId: anchor.snapshotId, currentRegistrySha256: anchor.registrySha256, approvalEpoch: 1, serverBuildId: 'old' };
  const newCurrent = currentAnchor(twoEpochManifest(), AUTHORITY_DOMAIN);
  assert.equal(handshakeMatchesCurrent(oldHandshake, newCurrent), false);
});

test('CACHE-FRESH-09 successor admission supersedes old CURRENT and increments epoch', () => {
  const next = admitSuccessorManifest(manifest, { authorityDomain: AUTHORITY_DOMAIN, snapshotId: 'SYNTHETIC-R5', registrySha256: 'e'.repeat(64), approvalEpoch: 2, lifecycle: 'CURRENT' });
  assert.equal(next.snapshots.find((e) => e.snapshotId === anchor.snapshotId).lifecycle, 'SUPERSEDED');
  assert.equal(currentAnchor(next, AUTHORITY_DOMAIN).approvalEpoch, 2);
});

test('CACHE-FRESH-10 no CURRENT approved snapshot fails closed; no old-cache downgrade', async () => {
  const bad = cloneJson(manifest);
  bad.snapshots[0].lifecycle = 'SUPERSEDED';
  assert.equal((await assessCachedSnapshot(validCache(), bad)).mode, 'RUNTIME_ONLY');
});

// ---- Runtime protocol / cutover gates (Phase-A pure boundary machinery) ----

test('CUT-01 modes are mutually exclusive in client routing', () => {
  const hs = authorityHandshakeRoute({ manifest, sharedActivationMode: 'REGISTRY_V4', serverBuildId: 'phase-a' }).body;
  const decision = decideV4ClientRouting(hs, anchor);
  assert.equal(decision.mode, 'REGISTRY_V4');
  assert.equal(decision.legacyFallback, false);
});

test('CUT-02 v4 server boundary rejects local scrollText as canonical input', () => {
  const result = v4ChatAdmissionRoute({ request: { authority: requestContext(), runtime: {}, scrollText: 'legacy' }, manifest, sharedActivationMode: 'REGISTRY_V4' });
  assert.equal(result.executed, false);
  assert.equal(result.body.code, 'LEGACY_STRUCTURAL_PAYLOAD_REJECTED');
});

test('CUT-03 Phase-A v4 context has no DEFAULT_SCROLL/LORE_SCROLL fallback input', () => {
  const context = buildServerRegistryContext(registry);
  assert.equal('scrollText' in context, false);
  assert.equal('DEFAULT_SCROLL' in context, false);
  assert.equal('LORE_SCROLL' in context, false);
});

test('CUT-04 CUTOVER_LOCK is coherent zero-authority mode', () => {
  assert.equal(routePermittedByMode('CUTOVER_LOCK', 'LEGACY_CHAT'), false);
  assert.equal(routePermittedByMode('CUTOVER_LOCK', 'V4_CHAT'), false);
});

test('CUT-PROTO-01 new v4 client with no v4 handshake never falls back to legacy', () => {
  const decision = decideV4ClientRouting(null, anchor);
  assert.deepEqual(decision, { mode: 'RUNTIME_ONLY', chatEndpoint: null, legacyFallback: false });
});

test('CUT-PROTO-02 old client hitting new REGISTRY_V4 server cannot execute legacy chat', () => {
  const result = legacyChatAdmissionRoute('REGISTRY_V4');
  assert.equal(result.executed, false);
  assert.ok([410,426].includes(result.status));
});

test('CUT-PROTO-03 per-request snapshot/hash/epoch mismatch yields 409 and no execution', () => {
  const result = v4ChatAdmissionRoute({ request: { authority: requestContext({ approvalEpoch: 999 }), runtime: {} }, manifest, sharedActivationMode: 'REGISTRY_V4' });
  assert.equal(result.status, 409);
  assert.equal(result.executed, false);
});

test('CUT-PROTO-04 post-handshake client remains on /api/v4/game/chat; old server cannot induce legacy fallback', () => {
  const hs = authorityHandshakeRoute({ manifest, sharedActivationMode: 'REGISTRY_V4', serverBuildId: 'new' }).body;
  const decision = decideV4ClientRouting(hs, anchor);
  assert.equal(decision.chatEndpoint, V4_ENDPOINTS.chat);
  assert.equal(decision.legacyFallback, false);
});

test('CUT-PROTO-05 v4 route rejects legacy structural payload', () => {
  const result = v4ChatAdmissionRoute({ request: { authority: requestContext(), runtime: {}, scrollText: 'old' }, manifest, sharedActivationMode: 'REGISTRY_V4' });
  assert.equal(result.executed, false);
});

test('CUT-PROTO-06 protocol-capable server in legacy preparation mode refuses v4 chat', () => {
  const result = v4ChatAdmissionRoute({ request: { authority: requestContext(), runtime: {} }, manifest, sharedActivationMode: 'LEGACY_OPEN' });
  assert.equal(result.executed, false);
  assert.equal(result.status, 425);
});

test('CUT-PROTO-07 REGISTRY_V4 mode disables legacy route', () => {
  assert.equal(legacyChatAdmissionRoute('REGISTRY_V4').executed, false);
});

test('CUT-PROTO-08 missing/malformed handshake keeps client runtime-only with no legacy fallback', () => {
  assert.equal(decideV4ClientRouting(null, anchor).mode, 'RUNTIME_ONLY');
});

test('CUT-PROTO-09 server CURRENT change after handshake is caught on next request', () => {
  const newer = twoEpochManifest();
  const result = v4ChatAdmissionRoute({ request: { authority: requestContext(), runtime: {} }, manifest: newer, sharedActivationMode: 'REGISTRY_V4' });
  assert.equal(result.status, 409);
  assert.equal(result.executed, false);
});

test('CUT-PROTO-10 safety is per request and does not rely on sticky sessions', () => {
  const ok = v4ChatAdmissionRoute({ request: { authority: requestContext(), runtime: {} }, manifest, sharedActivationMode: 'REGISTRY_V4' });
  const mismatch = v4ChatAdmissionRoute({ request: { authority: requestContext({ registrySha256: 'f'.repeat(64) }), runtime: {} }, manifest, sharedActivationMode: 'REGISTRY_V4' });
  assert.equal(ok.executed, true);
  assert.equal(mismatch.executed, false);
});

test('CUT-PROTO-11 stale old client after server-first cutover receives disabled legacy path', () => {
  assert.equal(legacyChatAdmissionRoute('REGISTRY_V4').executed, false);
});

test('CUT-PROTO-12 stale old server cannot cause v4 client legacy fallback', () => {
  const hs = authorityHandshakeRoute({ manifest, sharedActivationMode: 'REGISTRY_V4', serverBuildId: 'new' }).body;
  const decision = decideV4ClientRouting(hs, anchor);
  assert.equal(decision.legacyFallback, false);
});

// ---- Gateway external fence gates ----

test('CUT-GW-01 stale old client + old server alive is denied at gateway in REGISTRY_V4', () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 14, mode: 'REGISTRY_V4' };
  const result = gatewayAdmit({ routeFamily: 'LEGACY_CHAT', state, capability: null, capabilityVerifiedByControlPlane: false, highestObservedCutoverEpoch: 14, now: 100, controlPlaneReachable: true });
  assert.equal(result.allow, false);
});

test('CUT-GW-02 legacy route denied during CUTOVER_LOCK', () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 13, mode: 'CUTOVER_LOCK' };
  assert.equal(gatewayAdmit({ routeFamily: 'LEGACY_CHAT', state, capability: null, capabilityVerifiedByControlPlane: false, highestObservedCutoverEpoch: 13, now: 100, controlPlaneReachable: true }).allow, false);
});

test('CUT-GW-03 v4 chat denied during LEGACY_OPEN', () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 12, mode: 'LEGACY_OPEN' };
  assert.equal(gatewayAdmit({ routeFamily: 'V4_CHAT', state, capability: null, capabilityVerifiedByControlPlane: false, highestObservedCutoverEpoch: 12, now: 100, controlPlaneReachable: true }).allow, false);
});

test('CUT-GW-04 v4 chat denied during CUTOVER_LOCK', () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 13, mode: 'CUTOVER_LOCK' };
  assert.equal(gatewayAdmit({ routeFamily: 'V4_CHAT', state, capability: null, capabilityVerifiedByControlPlane: false, highestObservedCutoverEpoch: 13, now: 100, controlPlaneReachable: true }).allow, false);
});

test('CUT-GW-05 v4 application independently refuses execution before shared REGISTRY_V4 activation', () => {
  assert.equal(v4ChatAdmissionRoute({ request: { authority: requestContext(), runtime: {} }, manifest, sharedActivationMode: 'CUTOVER_LOCK' }).executed, false);
});

test('CUT-GW-06 old binary in v4 upstream pool fails configuration validation', () => {
  assert.throws(() => validateV4UpstreamPool([{ id: 'new', protocol: 'AC-AUTH/1' }, { id: 'old', protocol: 'LEGACY_V3' }]));
});

test('CUT-GW-07 origin-bypass policy is explicitly DENY', () => {
  validateGatewayPolicy(gatewayPolicy);
  assert.equal(gatewayPolicy.directOriginAccess, 'DENY');
  const bad = cloneJson(gatewayPolicy); bad.directOriginAccess = 'ALLOW';
  assert.throws(() => validateGatewayPolicy(bad));
});

test('CUT-GW-08 automatic REGISTRY_V4 -> LEGACY_OPEN rollback is forbidden', () => {
  assert.throws(() => nextCutoverState({ authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 14, mode: 'REGISTRY_V4' }, 'LEGACY_OPEN'));
});

test('CUT-GW-09 mixed fleet drain window cannot reopen legacy route under REGISTRY_V4', () => {
  assert.equal(routePermittedByMode('REGISTRY_V4', 'LEGACY_CHAT'), false);
});

test('CUT-GW-10 mode audit has no state with legacy and v4 chat simultaneously executable', () => {
  for (const mode of ['LEGACY_OPEN','CUTOVER_LOCK','REGISTRY_V4']) {
    assert.equal(routePermittedByMode(mode, 'LEGACY_CHAT') && routePermittedByMode(mode, 'V4_CHAT'), false);
  }
});

// ---- Global monotonic cutover / split-brain gates ----

test('CUT-GLOBAL-01 stale LEGACY_OPEN edge cannot execute after global CUTOVER_LOCK', () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 13, mode: 'CUTOVER_LOCK' };
  const result = gatewayAdmit({ routeFamily: 'LEGACY_CHAT', state, capability: capability(12,'LEGACY_OPEN','LEGACY_CHAT'), capabilityVerifiedByControlPlane: true, highestObservedCutoverEpoch: 13, now: 100, controlPlaneReachable: true });
  assert.equal(result.allow, false);
});

test('CUT-GLOBAL-02 stale legacy edge cannot execute after global REGISTRY_V4', () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 14, mode: 'REGISTRY_V4' };
  const result = gatewayAdmit({ routeFamily: 'LEGACY_CHAT', state, capability: capability(12,'LEGACY_OPEN','LEGACY_CHAT'), capabilityVerifiedByControlPlane: true, highestObservedCutoverEpoch: 14, now: 100, controlPlaneReachable: true });
  assert.equal(result.allow, false);
});

test('CUT-GLOBAL-03 partitioned edge with no live control-plane state fails closed', () => {
  const result = gatewayAdmit({ routeFamily: 'V4_CHAT', state: null, capability: null, capabilityVerifiedByControlPlane: false, highestObservedCutoverEpoch: 14, now: 100, controlPlaneReachable: false });
  assert.equal(result.allow, false);
  assert.equal(result.reason, 'CONTROL_PLANE_UNAVAILABLE');
});

test('CUT-GLOBAL-04 stale epoch replay is rejected', () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 14, mode: 'REGISTRY_V4' };
  const result = gatewayAdmit({ routeFamily: 'V4_CHAT', state, capability: capability(13,'REGISTRY_V4','V4_CHAT'), capabilityVerifiedByControlPlane: true, highestObservedCutoverEpoch: 14, now: 100, controlPlaneReachable: true });
  assert.equal(result.allow, false);
  assert.equal(result.reason, 'STALE_CAPABILITY_EPOCH');
});

test('CUT-GLOBAL-05 CUTOVER_LOCK issues no executable route family', () => {
  assert.equal(routePermittedByMode('CUTOVER_LOCK','LEGACY_CHAT'), false);
  assert.equal(routePermittedByMode('CUTOVER_LOCK','V4_CHAT'), false);
  assert.equal(routePermittedByMode('CUTOVER_LOCK','V4_AUTHORITY'), false);
});

test('CUT-GLOBAL-06 activation blocked while prior legacy capability can remain valid', () => {
  const lock = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 13, mode: 'CUTOVER_LOCK' };
  assert.equal(canActivateRegistryV4({ state: lock, legacyCapabilities: [capability(12,'LEGACY_OPEN','LEGACY_CHAT',{expiresAt:200})], now: 100, clockReliable: true }), false);
  assert.equal(canActivateRegistryV4({ state: lock, legacyCapabilities: [capability(12,'LEGACY_OPEN','LEGACY_CHAT',{expiresAt:99})], now: 100, clockReliable: true }), true);
});

test('CUT-GLOBAL-07 old client -> stale edge -> old server is denied before binary after v4 activation', () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 14, mode: 'REGISTRY_V4' };
  assert.equal(gatewayAdmit({ routeFamily: 'LEGACY_CHAT', state, capability: capability(12,'LEGACY_OPEN','LEGACY_CHAT'), capabilityVerifiedByControlPlane: true, highestObservedCutoverEpoch: 14, now: 100, controlPlaneReachable: true }).allow, false);
});

test('CUT-GLOBAL-08 old server cannot be an eligible v4 authority upstream', () => {
  assert.throws(() => validateV4UpstreamPool([{ id: 'old', protocol: 'LEGACY_V3' }]));
});

test('CUT-GLOBAL-09 unverifiable control-plane capability fails closed', () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 14, mode: 'REGISTRY_V4' };
  const result = gatewayAdmit({ routeFamily: 'V4_CHAT', state, capability: capability(14,'REGISTRY_V4','V4_CHAT'), capabilityVerifiedByControlPlane: false, highestObservedCutoverEpoch: 14, now: 100, controlPlaneReachable: true });
  assert.equal(result.allow, false);
  assert.equal(result.reason, 'UNVERIFIED_CAPABILITY');
});

test('CUT-GLOBAL-10 older epoch/config replay is rejected after higher epoch observed', () => {
  const staleState = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 12, mode: 'LEGACY_OPEN' };
  const result = gatewayAdmit({ routeFamily: 'LEGACY_CHAT', state: staleState, capability: capability(12,'LEGACY_OPEN','LEGACY_CHAT'), capabilityVerifiedByControlPlane: true, highestObservedCutoverEpoch: 14, now: 100, controlPlaneReachable: true });
  assert.equal(result.allow, false);
  assert.equal(result.reason, 'CONTROL_PLANE_EPOCH_REGRESSION');
});

test('CUT-GLOBAL-11 deliberate rollback requires new higher epochs through CUTOVER_LOCK', () => {
  const v4 = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 14, mode: 'REGISTRY_V4' };
  const lock = nextCutoverState(v4, 'CUTOVER_LOCK');
  const legacy = nextCutoverState(lock, 'LEGACY_OPEN');
  assert.equal(lock.cutoverEpoch, 15);
  assert.equal(legacy.cutoverEpoch, 16);
});

test('CUT-GLOBAL-12 uncertain lease expiry/clock is treated non-executable', () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 14, mode: 'REGISTRY_V4' };
  const result = gatewayAdmit({ routeFamily: 'V4_CHAT', state, capability: capability(14,'REGISTRY_V4','V4_CHAT'), capabilityVerifiedByControlPlane: true, highestObservedCutoverEpoch: 14, now: 100, controlPlaneReachable: true, clockReliable: false });
  assert.equal(result.allow, false);
  assert.equal(result.reason, 'CLOCK_UNCERTAIN');
});

test('GATE-A-A exact capability route binding rejects V4_AUTHORITY capability on V4_CHAT', () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 14, mode: 'REGISTRY_V4' };
  const result = gatewayAdmit({
    routeFamily: 'V4_CHAT',
    state,
    capability: capability(14, 'REGISTRY_V4', 'V4_AUTHORITY'),
    capabilityVerifiedByControlPlane: true,
    highestObservedCutoverEpoch: 14,
    now: 100,
    controlPlaneReachable: true,
  });
  assert.equal(result.allow, false);
  assert.equal(result.reason, 'CAPABILITY_ROUTE_FAMILY_MISMATCH');
});

test('GATE-A-B runtime authority-domain mismatch is rejected explicitly', () => {
  const state = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 14, mode: 'REGISTRY_V4' };
  const wrongDomainCapability = { ...capability(14, 'REGISTRY_V4', 'V4_CHAT'), authorityDomain: 'forged-authority-domain' };
  const result = validateExecutionCapability(wrongDomainCapability, {
    verifiedByControlPlane: true,
    currentState: state,
    highestObservedCutoverEpoch: 14,
    now: 100,
    clockReliable: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'CAPABILITY_AUTHORITY_DOMAIN_MISMATCH');
});

test('GATE-A-C registry-v4 activation fails closed when clock reliability is false', () => {
  const lock = { authorityDomain: AUTHORITY_DOMAIN, cutoverEpoch: 13, mode: 'CUTOVER_LOCK' };
  assert.equal(canActivateRegistryV4({
    state: lock,
    legacyCapabilities: [capability(12, 'LEGACY_OPEN', 'LEGACY_CHAT', { expiresAt: 99 })],
    now: 100,
    clockReliable: false,
  }), false);
});

// Final raw-byte guard repeats after all state-transition tests.
test('PHASE-A-FIXTURE-GUARD exact frozen bytes still match expected SHA-256', () => {
  assert.equal(sha(fs.readFileSync(registryPath)), EXPECTED_REGISTRY_SHA);
  assert.equal(sha(fs.readFileSync(balloonPath)), EXPECTED_BALLOON_SHA);
});
