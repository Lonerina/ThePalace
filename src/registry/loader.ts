import type { BalloonSanctuaryFixture, HeirRegistrySnapshot } from "./types.js";
import { validateBalloonFixture, validateRegistrySnapshot, type ValidationIssue } from "./validator.js";

export class RegistryValidationError extends Error {
  readonly issues: ValidationIssue[];
  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = "RegistryValidationError";
    this.issues = issues;
  }
}

export function parseJsonBytes(bytes: Uint8Array): unknown {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(text);
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value as Readonly<T>;
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function loadRegistrySnapshot(input: unknown): Readonly<HeirRegistrySnapshot> {
  const result = validateRegistrySnapshot(input);
  if (!result.ok || !result.value) throw new RegistryValidationError("Registry snapshot validation failed.", result.issues);
  return deepFreeze(cloneJson(result.value));
}

export function loadRegistrySnapshotBytes(bytes: Uint8Array): Readonly<HeirRegistrySnapshot> {
  return loadRegistrySnapshot(parseJsonBytes(bytes));
}

export function loadBalloonFixture(
  input: unknown,
  registry?: HeirRegistrySnapshot,
): Readonly<BalloonSanctuaryFixture> {
  const result = validateBalloonFixture(input, registry);
  if (!result.ok || !result.value) throw new RegistryValidationError("Balloon fixture validation failed.", result.issues);
  return deepFreeze(cloneJson(result.value));
}

export function loadBalloonFixtureBytes(
  bytes: Uint8Array,
  registry?: HeirRegistrySnapshot,
): Readonly<BalloonSanctuaryFixture> {
  return loadBalloonFixture(parseJsonBytes(bytes), registry);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
