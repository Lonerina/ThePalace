import type { ApprovedSnapshotManifestV1 } from "../registry/trustRoot.js";
import type { StorageAdapter } from "./storage.js";

const registryAssetUrl = new URL("../../registry/rc4/01_heir_registry_snapshot.v1.2.json", import.meta.url);
const manifestAssetUrl = new URL("../../registry/approved/approved-snapshots.v1.json", import.meta.url);

export class BrowserStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null { return window.localStorage.getItem(key); }
  setItem(key: string, value: string): void { window.localStorage.setItem(key, value); }
  removeItem(key: string): void { window.localStorage.removeItem(key); }
}

export async function loadBundledAuthorityInputs(fetcher: typeof fetch = fetch): Promise<{
  registryText: string;
  registryBytes: Uint8Array;
  manifest: ApprovedSnapshotManifestV1;
}> {
  const [registryResponse, manifestResponse] = await Promise.all([
    fetcher(registryAssetUrl),
    fetcher(manifestAssetUrl),
  ]);
  if (!registryResponse.ok || !manifestResponse.ok) throw new Error("Bundled RC4 authority assets are unavailable.");
  const registryText = await registryResponse.text();
  const manifest = await manifestResponse.json() as ApprovedSnapshotManifestV1;
  return { registryText, registryBytes: new TextEncoder().encode(registryText), manifest };
}
