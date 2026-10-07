import type { ClientGeneration, ClientGenerationAdapter } from "./generationTypes.js";

export const CLIENT_GENERATION: ClientGeneration = "REGISTRY_V4" as ClientGeneration;

export const bootClientGeneration: ClientGenerationAdapter["bootClientGeneration"] =
  async () => { throw new Error("type-only client generation shim"); };
export const persistClientGeneration: ClientGenerationAdapter["persistClientGeneration"] =
  () => { throw new Error("type-only client generation shim"); };
export const canExecuteClientGeneration: ClientGenerationAdapter["canExecuteClientGeneration"] =
  () => false;
export const sendClientNarrative: ClientGenerationAdapter["sendClientNarrative"] =
  async () => { throw new Error("type-only client generation shim"); };
export const resetClientGeneration: ClientGenerationAdapter["resetClientGeneration"] =
  () => {};
