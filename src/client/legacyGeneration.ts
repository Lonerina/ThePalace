import type { ClientBootArgs, ClientBootResult, ClientGenerationAdapter, ClientNarrativeArgs, ClientPersistArgs } from "./generationTypes.js";
import { STORAGE_KEYS } from "../runtime/storage.js";
import type { PalaceRuntimeStateV4 } from "../runtime/types.js";

export const CLIENT_GENERATION = "LEGACY_V3" as const;
const LEGACY_CHAT_ENDPOINT = "/api/game/chat" as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? clone(value as Record<string, unknown>) : {};
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? clone(value) : [];
}

function parseLegacy(storageText: string | null): Record<string, unknown> {
  if (!storageText) return {};
  try {
    const parsed = JSON.parse(storageText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function mergeLegacyCharacters(defaults: unknown[], legacyCharacters: unknown, relationships: unknown): unknown[] {
  const defaultRecords = clone(defaults) as Array<Record<string, unknown>>;
  if (Array.isArray(legacyCharacters)) {
    const merged = clone(legacyCharacters) as Array<Record<string, unknown>>;
    for (const defaultChar of defaultRecords) {
      const id = typeof defaultChar.id === "string" ? defaultChar.id : "";
      const index = merged.findIndex((candidate) => candidate && typeof candidate === "object" && (candidate as Record<string, unknown>).id === id);
      if (index === -1) merged.push(defaultChar);
      else merged[index] = {
        ...defaultChar,
        ...(merged[index] as Record<string, unknown>),
        metrics: (merged[index] as Record<string, unknown>).metrics ?? defaultChar.metrics,
      };
    }
    return merged;
  }
  const relationMap = relationships && typeof relationships === "object" && !Array.isArray(relationships)
    ? relationships as Record<string, unknown>
    : {};
  return defaultRecords.map((character) => {
    const id = typeof character.id === "string" ? character.id : "";
    return relationMap[id] ? { ...character, metrics: clone(relationMap[id]) } : character;
  });
}

function runtimeFromLegacy(legacy: Record<string, unknown>): PalaceRuntimeStateV4 {
  return {
    schemaVersion: "palace-runtime-v4",
    migratedFrom: "anchor_court_game_state_v3",
    activeUiRoomId: typeof legacy.activeChamberId === "string" ? legacy.activeChamberId : "assembly",
    histories: objectOrEmpty(legacy.histories),
    relationships: objectOrEmpty(legacy.relationships),
    inventory: arrayOrEmpty(legacy.inventory),
    journal: arrayOrEmpty(legacy.journal),
    suggestedChoices: objectOrEmpty(legacy.suggestedChoices),
    runtimeProfiles: [],
    sandboxEntities: [],
    runtimeOnly: { clientGeneration: CLIENT_GENERATION },
    warnings: [],
  };
}

export async function bootClientGeneration(args: ClientBootArgs): Promise<ClientBootResult> {
  const legacy = parseLegacy(args.storage.getItem(STORAGE_KEYS.legacyV3));
  const runtime = runtimeFromLegacy(legacy);
  const displayCharacters = mergeLegacyCharacters(args.defaultCharacters, legacy.characters, legacy.relationships);
  return {
    generation: CLIENT_GENERATION,
    mode: "LEGACY_V3",
    runtime,
    palaceRegistry: null,
    displayCharacters,
    scrollText: typeof legacy.scrollText === "string" && legacy.scrollText ? legacy.scrollText : args.defaultScroll,
    authorityRequest: null,
    reason: "Explicit LEGACY_V3 client build generation.",
    warnings: [],
  };
}

export function persistClientGeneration(args: ClientPersistArgs): PalaceRuntimeStateV4 {
  const legacyState = {
    activeChamberId: args.activeUiRoomId,
    histories: clone(args.histories),
    relationships: clone(args.relationships),
    characters: clone(args.displayCharacters),
    inventory: clone(args.inventory),
    journal: clone(args.journal),
    suggestedChoices: clone(args.suggestedChoices),
    scrollText: args.scrollText,
  };
  args.storage.setItem(STORAGE_KEYS.legacyV3, JSON.stringify(legacyState));
  return {
    ...args.previousRuntime,
    migratedFrom: "anchor_court_game_state_v3",
    activeUiRoomId: args.activeUiRoomId,
    histories: clone(args.histories),
    relationships: clone(args.relationships),
    inventory: clone(args.inventory),
    journal: clone(args.journal),
    suggestedChoices: clone(args.suggestedChoices),
    runtimeOnly: { ...args.previousRuntime.runtimeOnly, clientGeneration: CLIENT_GENERATION },
  };
}

export function canExecuteClientGeneration(mode: "LEGACY_V3" | "REGISTRY_V4" | "RUNTIME_ONLY"): boolean {
  return mode === "LEGACY_V3";
}

export async function sendClientNarrative(args: ClientNarrativeArgs) {
  if (!canExecuteClientGeneration(args.mode)) throw new Error("LEGACY_V3 client generation is not executable in the current client mode.");
  return args.fetcher(LEGACY_CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...args.runtimePayload, scrollText: args.scrollText }),
  });
}

export function resetClientGeneration(storage: ClientPersistArgs["storage"]): void {
  storage.removeItem(STORAGE_KEYS.legacyV3);
}

export const clientGenerationAdapter: ClientGenerationAdapter = {
  CLIENT_GENERATION,
  bootClientGeneration,
  persistClientGeneration,
  canExecuteClientGeneration,
  sendClientNarrative,
  resetClientGeneration,
};
