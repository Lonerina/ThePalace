import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AUTHORITY_DOMAIN } from "../../.phase-b-dist/src/authority/protocol.js";
import { currentAnchor } from "../../.phase-b-dist/src/registry/trustRoot.js";
import { MemoryStorage } from "../../.phase-b-dist/src/runtime/storage.js";
import {
  CLIENT_GENERATION as LEGACY_GENERATION,
  bootClientGeneration as bootLegacyClient,
  sendClientNarrative as sendLegacyNarrative,
} from "../../.phase-b-dist/src/client/legacyGeneration.js";
import {
  CLIENT_GENERATION as V4_GENERATION,
  bootClientGeneration as bootV4Client,
  sendClientNarrative as sendV4Narrative,
} from "../../.phase-b-dist/src/client/registryV4Generation.js";
import {
  authorityHandshakeRoute,
  legacyChatAdmissionRoute,
  v4ChatAdmissionRoute,
} from "../../.phase-b-dist/src/server/v4AuthorityRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const registryText = fs.readFileSync(path.join(root, "registry/rc4/01_heir_registry_snapshot.v1.2.json"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "registry/approved/approved-snapshots.v1.json"), "utf8"));
const appSource = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const viteSource = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");
const legacySource = fs.readFileSync(path.join(root, "src/client/legacyGeneration.ts"), "utf8");
const v4Source = fs.readFileSync(path.join(root, "src/client/registryV4Generation.ts"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const anchor = currentAnchor(manifest, AUTHORITY_DOMAIN);

const defaultCharacters = [
  {
    id: "Kai",
    name: "Kai Nur Tsaiyunk",
    title: "Presentation profile",
    category: "king",
    metrics: { trust: 50, passion: 50, suspicion: 10 },
  },
];
const builtInIds = new Set(["Kai"]);

function legacyState() {
  return {
    activeChamberId: "Kai",
    histories: { Kai: [] },
    relationships: { Kai: { trust: 70, passion: 60, suspicion: 10 } },
    characters: defaultCharacters,
    inventory: [],
    journal: [],
    suggestedChoices: {},
    scrollText: "LEGACY PREPARATION REGISTER",
  };
}

function assetAndHandshakeFetcher(serverMode) {
  return async (url) => {
    const key = String(url);
    if (key.includes("01_heir_registry_snapshot.v1.2.json")) {
      return {
        ok: true,
        status: 200,
        text: async () => registryText,
        json: async () => JSON.parse(registryText),
      };
    }
    if (key.includes("approved-snapshots.v1.json")) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(manifest),
        json: async () => manifest,
      };
    }
    if (key === "/api/v4/authority") {
      const route = authorityHandshakeRoute({
        manifest,
        sharedActivationMode: serverMode,
        serverBuildId: "rollout-test",
      });
      return {
        ok: route.status >= 200 && route.status < 300,
        status: route.status,
        text: async () => JSON.stringify(route.body),
        json: async () => route.body,
      };
    }
    throw new Error(`Unexpected fetch URL: ${key}`);
  };
}

test("ROLLOUT-01 protocol-capable server + explicit LEGACY_V3 client works during LEGACY_OPEN preparation", async () => {
  const storage = new MemoryStorage({
    anchor_court_game_state_v3: JSON.stringify(legacyState()),
    client_generation: "REGISTRY_V4",
  });
  const boot = await bootLegacyClient({
    storage,
    builtInIds,
    defaultCharacters,
    defaultScroll: "DEFAULT",
    fetcher: async () => { throw new Error("legacy boot must not negotiate v4"); },
  });
  assert.equal(boot.generation, "LEGACY_V3");
  assert.equal(boot.mode, "LEGACY_V3");

  let seenUrl = null;
  const response = await sendLegacyNarrative({
    fetcher: async (url) => {
      seenUrl = url;
      const admission = legacyChatAdmissionRoute("LEGACY_OPEN");
      return { ok: admission.executed, status: admission.status, json: async () => ({ ok: admission.executed }) };
    },
    mode: boot.mode,
    authorityRequest: null,
    runtimePayload: { chamberId: "Kai", playerInput: "preparation" },
    scrollText: boot.scrollText,
  });
  assert.equal(seenUrl, "/api/game/chat");
  assert.equal(response.ok, true);
});

test("ROLLOUT-02 REGISTRY_V4 client before activation becomes RUNTIME_ONLY and never falls back to legacy", async () => {
  const boot = await bootV4Client({
    storage: new MemoryStorage(),
    builtInIds,
    defaultCharacters,
    defaultScroll: "DEFAULT",
    fetcher: assetAndHandshakeFetcher("LEGACY_OPEN"),
  });
  assert.equal(boot.generation, "REGISTRY_V4");
  assert.equal(boot.mode, "RUNTIME_ONLY");
  await assert.rejects(
    () => sendV4Narrative({
      fetcher: async () => { throw new Error("no request should execute"); },
      mode: boot.mode,
      authorityRequest: boot.authorityRequest,
      runtimePayload: { chamberId: "Kai" },
      scrollText: "HOSTILE LEGACY",
    }),
    /RUNTIME_ONLY/,
  );
  assert.equal(v4Source.includes("/api/game/chat"), false);
});

test("ROLLOUT-03 CUTOVER_LOCK executes neither client generation", () => {
  assert.equal(legacyChatAdmissionRoute("CUTOVER_LOCK").executed, false);
  const v4 = v4ChatAdmissionRoute({
    request: {
      authority: {
        authorityProtocol: "AC-AUTH/1",
        authorityDomain: AUTHORITY_DOMAIN,
        snapshotId: anchor.snapshotId,
        registrySha256: anchor.registrySha256,
        approvalEpoch: anchor.approvalEpoch,
      },
      runtime: { chamberId: "Kai" },
    },
    manifest,
    sharedActivationMode: "CUTOVER_LOCK",
  });
  assert.equal(v4.executed, false);
});

test("ROLLOUT-04 stale LEGACY_V3 client is denied after server enters REGISTRY_V4", () => {
  const admission = legacyChatAdmissionRoute("REGISTRY_V4");
  assert.equal(admission.executed, false);
  assert.equal(admission.status, 426);
});

test("ROLLOUT-05 REGISTRY_V4 client succeeds only against current REGISTRY_V4 server", async () => {
  const boot = await bootV4Client({
    storage: new MemoryStorage(),
    builtInIds,
    defaultCharacters,
    defaultScroll: "DEFAULT",
    fetcher: assetAndHandshakeFetcher("REGISTRY_V4"),
  });
  assert.equal(boot.mode, "REGISTRY_V4");
  assert.ok(boot.authorityRequest);

  let seenUrl = null;
  const response = await sendV4Narrative({
    fetcher: async (url) => {
      seenUrl = url;
      const admission = v4ChatAdmissionRoute({
        request: {
          authority: boot.authorityRequest,
          runtime: { chamberId: "Kai", playerInput: "v4" },
        },
        manifest,
        sharedActivationMode: "REGISTRY_V4",
      });
      return { ok: admission.executed, status: admission.status, json: async () => admission.body };
    },
    mode: boot.mode,
    authorityRequest: boot.authorityRequest,
    runtimePayload: { chamberId: "Kai", playerInput: "v4" },
    scrollText: "MUST NOT CROSS V4 BOUNDARY",
  });
  assert.equal(seenUrl, "/api/v4/game/chat");
  assert.equal(response.ok, true);
});

test("ROLLOUT-06 client generation cannot be changed by runtime or localStorage", async () => {
  const legacyStorage = new MemoryStorage({
    client_generation: "REGISTRY_V4",
    CLIENT_GENERATION: "REGISTRY_V4",
    anchor_court_game_state_v3: JSON.stringify({ ...legacyState(), clientGeneration: "REGISTRY_V4" }),
  });
  const legacyBoot = await bootLegacyClient({
    storage: legacyStorage,
    builtInIds,
    defaultCharacters,
    defaultScroll: "DEFAULT",
    fetcher: async () => { throw new Error("legacy generation must not negotiate"); },
  });
  assert.equal(LEGACY_GENERATION, "LEGACY_V3");
  assert.equal(legacyBoot.generation, "LEGACY_V3");

  const v4Storage = new MemoryStorage({
    client_generation: "LEGACY_V3",
    CLIENT_GENERATION: "LEGACY_V3",
  });
  const v4Boot = await bootV4Client({
    storage: v4Storage,
    builtInIds,
    defaultCharacters,
    defaultScroll: "DEFAULT",
    fetcher: assetAndHandshakeFetcher("REGISTRY_V4"),
  });
  assert.equal(V4_GENERATION, "REGISTRY_V4");
  assert.equal(v4Boot.generation, "REGISTRY_V4");
  assert.equal(v4Boot.mode, "REGISTRY_V4");
});

test("ROLLOUT-07 one production client artifact cannot expose both authority paths", () => {
  assert.match(appSource, /virtual:client-generation/);
  assert.equal(appSource.includes("./client/legacyGeneration"), false);
  assert.equal(appSource.includes("./client/registryV4Generation"), false);

  assert.match(viteSource, /generation === 'LEGACY_V3'/);
  assert.match(viteSource, /src\/client\/legacyGeneration\.ts/);
  assert.match(viteSource, /src\/client\/registryV4Generation\.ts/);

  assert.match(legacySource, /\/api\/game\/chat/);
  assert.equal(legacySource.includes("/api/v4/"), false);
  assert.match(v4Source, /V4_ENDPOINTS\.chat/);
  assert.equal(v4Source.includes("/api/game/chat"), false);

  assert.match(packageJson.scripts["build:legacy"], /CLIENT_GENERATION=LEGACY_V3/);
  assert.match(packageJson.scripts["build:v4"], /CLIENT_GENERATION=REGISTRY_V4/);
  assert.match(packageJson.scripts["build"], /verify:artifact:legacy/);
  assert.match(packageJson.scripts["build"], /verify:artifact:v4/);
});
