import type { ClientBootArgs, ClientBootResult, ClientGenerationAdapter, ClientNarrativeArgs, ClientPersistArgs } from "./generationTypes.js";
import { V4_ENDPOINTS } from "../authority/protocol.js";
import { loadBundledAuthorityInputs } from "../runtime/browserAuthority.js";
import {
  bootPalaceAuthority,
  buildRuntimeState,
  buildV4NarrativeRequest,
  negotiateV4Authority,
  persistRuntimeSession,
  restoreDisplayCharacters,
} from "../runtime/liveAuthority.js";
import { STORAGE_KEYS } from "../runtime/storage.js";

export const CLIENT_GENERATION = "REGISTRY_V4" as const;

export async function bootClientGeneration(args: ClientBootArgs): Promise<ClientBootResult> {
  const inputs = await loadBundledAuthorityInputs(args.fetcher as any);
  const boot = await bootPalaceAuthority({
    storage: args.storage,
    builtInIds: args.builtInIds,
    liveRegistryBytes: inputs.registryBytes,
    liveRegistryText: inputs.registryText,
    manifest: inputs.manifest,
  });
  const negotiated = await negotiateV4Authority({
    fetcher: args.fetcher,
    manifest: inputs.manifest,
    registryMode: boot.registryMode,
  });

  let scrollText = args.defaultScroll;
  const quarantineText = args.storage.getItem(STORAGE_KEYS.quarantineV1);
  if (quarantineText) {
    try {
      const quarantine = JSON.parse(quarantineText);
      if (typeof quarantine?.oldScrollDraft?.value === "string") scrollText = quarantine.oldScrollDraft.value;
    } catch {
      // Quarantine is evidence only. Parse failure cannot create authority.
    }
  }

  return {
    generation: CLIENT_GENERATION,
    mode: negotiated.mode,
    runtime: boot.runtime,
    palaceRegistry: boot.palaceRegistry,
    displayCharacters: restoreDisplayCharacters(boot.runtime, args.defaultCharacters),
    scrollText,
    authorityRequest: negotiated.authority,
    reason: negotiated.reason,
    warnings: boot.warnings,
  };
}

export function persistClientGeneration(args: ClientPersistArgs) {
  const nextRuntime = buildRuntimeState({
    previous: args.previousRuntime,
    activeUiRoomId: args.activeUiRoomId,
    histories: args.histories,
    relationships: args.relationships,
    inventory: args.inventory,
    journal: args.journal,
    suggestedChoices: args.suggestedChoices,
    displayCharacters: args.displayCharacters,
    builtInIds: args.builtInIds,
    canonicalNames: args.canonicalNames,
  });
  persistRuntimeSession(args.storage, nextRuntime);
  return nextRuntime;
}

export function canExecuteClientGeneration(mode: "LEGACY_V3" | "REGISTRY_V4" | "RUNTIME_ONLY", authorityRequest: ClientNarrativeArgs["authorityRequest"]): boolean {
  return mode === "REGISTRY_V4" && authorityRequest !== null;
}

export async function sendClientNarrative(args: ClientNarrativeArgs) {
  if (!canExecuteClientGeneration(args.mode, args.authorityRequest) || !args.authorityRequest) {
    throw new Error("REGISTRY_V4 client is RUNTIME_ONLY until a current AC-AUTH/1 handshake is admitted.");
  }
  return args.fetcher(V4_ENDPOINTS.chat, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildV4NarrativeRequest(args.authorityRequest, args.runtimePayload)),
  });
}

export function resetClientGeneration(storage: ClientPersistArgs["storage"]): void {
  storage.removeItem(STORAGE_KEYS.runtimeSessionV4);
}

export const clientGenerationAdapter: ClientGenerationAdapter = {
  CLIENT_GENERATION,
  bootClientGeneration,
  persistClientGeneration,
  canExecuteClientGeneration,
  sendClientNarrative,
  resetClientGeneration,
};
