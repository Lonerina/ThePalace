export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEYS = {
  legacyV3: "anchor_court_game_state_v3",
  runtimeV4: "anchor_court_runtime_v4",
  quarantineV1: "anchor_court_legacy_quarantine_v1",
  registryCacheV1: "anchor_court_registry_cache_v1",
  migrationCommitV1: "anchor_court_migration_commit_v1",
} as const;

export function stableStringify(value: unknown): string {
  function normalize(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      const obj = input as Record<string, unknown>;
      return Object.fromEntries(Object.keys(obj).sort().map((key) => [key, normalize(obj[key])]));
    }
    return input;
  }
  return JSON.stringify(normalize(value));
}

export class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>();
  readonly writes: string[] = [];
  failOnWriteKey: string | null = null;

  constructor(initial?: Record<string, string>) {
    for (const [key, value] of Object.entries(initial ?? {})) this.values.set(key, value);
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes.push(key);
    if (this.failOnWriteKey === key) throw new Error(`Injected storage failure on ${key}`);
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.values.entries());
  }
}
