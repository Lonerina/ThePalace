export const LEGACY_STRUCTURAL_CHARACTER_FIELDS = new Set([
  "name",
  "title",
  "category",
  "courtRole",
  "courtFunction",
  "elementalIdentity",
  "originStory",
  "relationship",
  "age",
]);

export interface LegacySandboxEntity {
  classification: "LEGACY_SANDBOX_ENTITY";
  localId: string;
  linkedEntityKey: null;
  collision: "POSSIBLE_CANONICAL_NAME_COLLISION" | null;
  record: Record<string, unknown>;
}

export interface LegacyBuiltinRuntimeProfile {
  classification: "LEGACY_BUILTIN_RUNTIME_PROFILE";
  localId: string;
  displayName: string | null;
  runtimePresentation: Record<string, unknown>;
}

export interface LegacyBuiltinQuarantineRecord {
  localId: string;
  structuralFields: Record<string, unknown>;
  fullLegacyRecord: Record<string, unknown>;
}

export interface CharacterClassificationResult {
  builtinRuntimeProfiles: LegacyBuiltinRuntimeProfile[];
  builtinQuarantine: LegacyBuiltinQuarantineRecord[];
  sandboxEntities: LegacySandboxEntity[];
  warnings: string[];
}

function cloneRecord(record: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
}

export function classifyLegacyCharacters(args: {
  records: unknown;
  builtInIds: ReadonlySet<string>;
  canonicalNames?: ReadonlySet<string>;
}): CharacterClassificationResult {
  const result: CharacterClassificationResult = {
    builtinRuntimeProfiles: [],
    builtinQuarantine: [],
    sandboxEntities: [],
    warnings: [],
  };
  if (!Array.isArray(args.records)) return result;

  for (const candidate of args.records) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const record = cloneRecord(candidate as Record<string, unknown>);
    const id = typeof record.id === "string" ? record.id : "";
    if (!id) {
      result.warnings.push("LEGACY_CHARACTER_WITHOUT_ID");
      continue;
    }
    if (args.builtInIds.has(id)) {
      const structuralFields: Record<string, unknown> = {};
      const runtimePresentation: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (key === "id") continue;
        if (LEGACY_STRUCTURAL_CHARACTER_FIELDS.has(key)) structuralFields[key] = value;
        else runtimePresentation[key] = value;
      }
      result.builtinRuntimeProfiles.push({
        classification: "LEGACY_BUILTIN_RUNTIME_PROFILE",
        localId: id,
        displayName: typeof record.name === "string" ? record.name : null,
        runtimePresentation,
      });
      result.builtinQuarantine.push({ localId: id, structuralFields, fullLegacyRecord: record });
      continue;
    }

    const name = typeof record.name === "string" ? record.name : null;
    const collision = name && args.canonicalNames?.has(name) ? "POSSIBLE_CANONICAL_NAME_COLLISION" : null;
    if (collision) result.warnings.push(`${collision}:${id}`);
    result.sandboxEntities.push({
      classification: "LEGACY_SANDBOX_ENTITY",
      localId: id,
      linkedEntityKey: null,
      collision,
      record,
    });
  }
  return result;
}
