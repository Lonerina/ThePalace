import type { PalaceRuntimeStateV4 } from "./types.js";

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
