import type { AuthorityRequestContextV1 } from "../authority/protocol.js";
import type { PalaceRegistryView } from "../consumers/palaceRegistry.js";
import type { StorageAdapter } from "../runtime/storage.js";
import type { PalaceRuntimeStateV4 } from "../runtime/types.js";

export type ClientGeneration = "LEGACY_V3" | "REGISTRY_V4";
export type ClientAuthorityMode = "LEGACY_V3" | "REGISTRY_V4" | "RUNTIME_ONLY";

export interface ClientFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<any>;
}

export type ClientFetch = (url: string, init?: RequestInit) => Promise<ClientFetchResponse>;

export interface ClientBootArgs {
  storage: StorageAdapter;
  builtInIds: ReadonlySet<string>;
  defaultCharacters: unknown[];
  defaultScroll: string;
  fetcher: ClientFetch;
}

export interface ClientBootResult {
  generation: ClientGeneration;
  mode: ClientAuthorityMode;
  runtime: PalaceRuntimeStateV4;
  palaceRegistry: Readonly<PalaceRegistryView> | null;
  displayCharacters: unknown[];
  scrollText: string;
  authorityRequest: AuthorityRequestContextV1 | null;
  reason: string;
  warnings: string[];
}

export interface ClientPersistArgs {
  storage: StorageAdapter;
  previousRuntime: PalaceRuntimeStateV4;
  activeUiRoomId: string;
  histories: Record<string, unknown>;
  relationships: Record<string, unknown>;
  inventory: unknown[];
  journal: unknown[];
  suggestedChoices: Record<string, unknown>;
  displayCharacters: unknown[];
  canonicalNames: ReadonlySet<string>;
  builtInIds: ReadonlySet<string>;
  scrollText: string;
}

export interface ClientNarrativeArgs {
  fetcher: ClientFetch;
  mode: ClientAuthorityMode;
  authorityRequest: AuthorityRequestContextV1 | null;
  runtimePayload: Record<string, unknown>;
  scrollText: string;
}

export interface ClientGenerationAdapter {
  readonly CLIENT_GENERATION: ClientGeneration;
  bootClientGeneration(args: ClientBootArgs): Promise<ClientBootResult>;
  persistClientGeneration(args: ClientPersistArgs): PalaceRuntimeStateV4;
  canExecuteClientGeneration(mode: ClientAuthorityMode, authorityRequest: AuthorityRequestContextV1 | null): boolean;
  sendClientNarrative(args: ClientNarrativeArgs): Promise<ClientFetchResponse>;
  resetClientGeneration(storage: StorageAdapter): void;
}
