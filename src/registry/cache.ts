import { loadRegistrySnapshotBytes, sha256Hex } from "./loader.js";
import { currentAnchor, validateApprovedManifest, type ApprovedSnapshotManifestV1 } from "./trustRoot.js";
import type { HeirRegistrySnapshot, RegistryConsumerMode } from "./types.js";

export interface RegistryCacheRecordV1 {
  schemaVersion: "registry-cache-v1";
  authorityDomain: string;
  snapshotId: string;
  registrySha256: string;
  approvalEpoch: number;
  sourceFingerprint: string;
  cachedAt: string;
  approval?: string;
  snapshotText: string;
}

export interface RegistrySelection {
  mode: RegistryConsumerMode;
  snapshot: Readonly<HeirRegistrySnapshot> | null;
  reason: string;
}

export async function assessCachedSnapshot(
  cache: RegistryCacheRecordV1,
  manifest: ApprovedSnapshotManifestV1,
): Promise<RegistrySelection> {
  try {
    validateApprovedManifest(manifest);
    const anchor = currentAnchor(manifest, cache.authorityDomain);
    if (cache.snapshotId !== anchor.snapshotId || cache.approvalEpoch !== anchor.approvalEpoch) {
      return { mode: "RUNTIME_ONLY", snapshot: null, reason: "Cache does not match CURRENT snapshot ID/epoch." };
    }
    const bytes = new TextEncoder().encode(cache.snapshotText);
    const hash = await sha256Hex(bytes);
    if (hash !== cache.registrySha256 || hash !== anchor.registrySha256) {
      return { mode: "RUNTIME_ONLY", snapshot: null, reason: "Cache bytes fail external/current hash admission." };
    }
    const snapshot = loadRegistrySnapshotBytes(bytes);
    if (snapshot.snapshot_id !== anchor.snapshotId || snapshot.source_set_fingerprint !== cache.sourceFingerprint) {
      return { mode: "RUNTIME_ONLY", snapshot: null, reason: "Cache metadata/provenance mismatch." };
    }
    return { mode: "CACHED_APPROVED", snapshot, reason: "Externally anchored CURRENT cache accepted." };
  } catch (error) {
    return { mode: "RUNTIME_ONLY", snapshot: null, reason: error instanceof Error ? error.message : "Cache validation failed." };
  }
}

export async function selectRegistryForRuntime(args: {
  liveBytes?: Uint8Array | null;
  cache?: RegistryCacheRecordV1 | null;
  manifest: ApprovedSnapshotManifestV1;
  authorityDomain: string;
}): Promise<RegistrySelection> {
  const anchor = currentAnchor(args.manifest, args.authorityDomain);
  if (args.liveBytes) {
    try {
      const hash = await sha256Hex(args.liveBytes);
      if (hash === anchor.registrySha256) {
        const snapshot = loadRegistrySnapshotBytes(args.liveBytes);
        if (snapshot.snapshot_id === anchor.snapshotId) return { mode: "LIVE_APPROVED", snapshot, reason: "Current live approved snapshot accepted." };
      }
    } catch {
      // Fall through to an independently admitted cache. Never reconstruct/fabricate.
    }
  }
  if (args.cache) return assessCachedSnapshot(args.cache, args.manifest);
  return { mode: "RUNTIME_ONLY", snapshot: null, reason: "No CURRENT externally anchored snapshot is available." };
}
