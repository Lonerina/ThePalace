import { loadRegistrySnapshotBytes, sha256Hex } from "./loader.js";
import type { HeirRegistrySnapshot } from "./types.js";

export type ApprovalLifecycle = "CURRENT" | "SUPERSEDED" | "REVOKED";

export interface ApprovedSnapshotAnchor {
  authorityDomain: string;
  snapshotId: string;
  registrySha256: string;
  approvalEpoch: number;
  lifecycle: ApprovalLifecycle;
}

export interface ApprovedBalloonAnchor {
  artifactId: string;
  balloonSha256: string;
  snapshotId: string;
}

export interface ApprovedSnapshotManifestV1 {
  schemaVersion: "approved-snapshots-v1";
  snapshots: ApprovedSnapshotAnchor[];
  balloonFixtures?: ApprovedBalloonAnchor[];
}

export class TrustRootError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrustRootError";
  }
}

export function validateApprovedManifest(manifest: ApprovedSnapshotManifestV1): void {
  if (manifest.schemaVersion !== "approved-snapshots-v1") throw new TrustRootError("Unsupported approved-snapshot manifest schema.");
  if (!Array.isArray(manifest.snapshots) || manifest.snapshots.length === 0) throw new TrustRootError("Approved-snapshot manifest contains no snapshot anchors.");

  const byDomain = new Map<string, ApprovedSnapshotAnchor[]>();
  for (const entry of manifest.snapshots) {
    if (!entry.authorityDomain || !entry.snapshotId || !/^[0-9a-f]{64}$/.test(entry.registrySha256)) {
      throw new TrustRootError("Approved-snapshot anchor contains invalid domain, snapshot ID, or SHA-256.");
    }
    if (!Number.isSafeInteger(entry.approvalEpoch) || entry.approvalEpoch < 0) throw new TrustRootError("approvalEpoch must be a non-negative safe integer.");
    if (!(["CURRENT", "SUPERSEDED", "REVOKED"] as const).includes(entry.lifecycle)) throw new TrustRootError("Invalid approval lifecycle.");
    const items = byDomain.get(entry.authorityDomain) ?? [];
    items.push(entry);
    byDomain.set(entry.authorityDomain, items);
  }

  for (const [domain, entries] of byDomain) {
    const epochSet = new Set<number>();
    for (const entry of entries) {
      if (epochSet.has(entry.approvalEpoch)) throw new TrustRootError(`Duplicate approvalEpoch in ${domain}.`);
      epochSet.add(entry.approvalEpoch);
    }
    const current = entries.filter((entry) => entry.lifecycle === "CURRENT");
    if (current.length !== 1) throw new TrustRootError(`Authority domain ${domain} must have exactly one CURRENT entry.`);
    const maxEpoch = Math.max(...entries.map((entry) => entry.approvalEpoch));
    if (current[0].approvalEpoch !== maxEpoch) throw new TrustRootError(`CURRENT entry for ${domain} must have the highest admitted approvalEpoch.`);
  }
}

export function currentAnchor(manifest: ApprovedSnapshotManifestV1, authorityDomain: string): ApprovedSnapshotAnchor {
  validateApprovedManifest(manifest);
  const entry = manifest.snapshots.find((candidate) => candidate.authorityDomain === authorityDomain && candidate.lifecycle === "CURRENT");
  if (!entry) throw new TrustRootError(`No CURRENT approved snapshot for ${authorityDomain}.`);
  return entry;
}

export function historicalAnchor(
  manifest: ApprovedSnapshotManifestV1,
  authorityDomain: string,
  snapshotId: string,
): ApprovedSnapshotAnchor | undefined {
  validateApprovedManifest(manifest);
  return manifest.snapshots.find((candidate) => candidate.authorityDomain === authorityDomain && candidate.snapshotId === snapshotId);
}

export async function admitSnapshotBytes(
  bytes: Uint8Array,
  manifest: ApprovedSnapshotManifestV1,
  authorityDomain: string,
): Promise<{ snapshot: Readonly<HeirRegistrySnapshot>; anchor: ApprovedSnapshotAnchor; registrySha256: string }> {
  const anchor = currentAnchor(manifest, authorityDomain);
  const registrySha256 = await sha256Hex(bytes);
  if (registrySha256 !== anchor.registrySha256) throw new TrustRootError("Registry bytes do not match CURRENT externally approved SHA-256.");
  const snapshot = loadRegistrySnapshotBytes(bytes);
  if (snapshot.snapshot_id !== anchor.snapshotId) throw new TrustRootError("Registry snapshot ID does not match CURRENT externally approved anchor.");
  return { snapshot, anchor, registrySha256 };
}

export function admitSuccessorManifest(
  previous: ApprovedSnapshotManifestV1,
  successor: ApprovedSnapshotAnchor,
): ApprovedSnapshotManifestV1 {
  validateApprovedManifest(previous);
  const oldCurrent = currentAnchor(previous, successor.authorityDomain);
  if (successor.approvalEpoch <= oldCurrent.approvalEpoch) throw new TrustRootError("Successor approvalEpoch must increase monotonically.");
  if (successor.lifecycle !== "CURRENT") throw new TrustRootError("Successor must enter as CURRENT.");
  const snapshots = previous.snapshots.map((entry) =>
    entry.authorityDomain === successor.authorityDomain && entry.lifecycle === "CURRENT"
      ? { ...entry, lifecycle: "SUPERSEDED" as const }
      : { ...entry },
  );
  snapshots.push({ ...successor });
  const next: ApprovedSnapshotManifestV1 = { ...previous, snapshots };
  validateApprovedManifest(next);
  return next;
}
