import { AUTHORITY_DOMAIN, validateRequestContext, type AuthorityRequestContextV1 } from "../authority/protocol.js";
import type { HeirRegistrySnapshot } from "../registry/types.js";
import { currentAnchor, type ApprovedSnapshotManifestV1 } from "../registry/trustRoot.js";

export interface V4NarrativeRequestEnvelope {
  authority: AuthorityRequestContextV1;
  runtime: Record<string, unknown>;
  scrollText?: unknown;
  [key: string]: unknown;
}

export interface ServerRegistryContext {
  snapshotId: string;
  sourceFingerprint: string;
  entities: Array<{
    entityKey: string;
    canonicalName: string | null;
    currentTier: string;
    birthBatch: string | null;
    currentStatus: string;
  }>;
}

export function validateServerAuthorityBoundary(args: {
  request: V4NarrativeRequestEnvelope;
  manifest: ApprovedSnapshotManifestV1;
  sharedActivationMode: "LEGACY_OPEN" | "CUTOVER_LOCK" | "REGISTRY_V4";
}): { ok: boolean; httpStatus: number; code: string } {
  if (args.sharedActivationMode !== "REGISTRY_V4") return { ok: false, httpStatus: 425, code: "AUTHORITY_MODE_INACTIVE" };
  if (Object.prototype.hasOwnProperty.call(args.request, "scrollText")) {
    return { ok: false, httpStatus: 400, code: "LEGACY_STRUCTURAL_PAYLOAD_REJECTED" };
  }
  const current = currentAnchor(args.manifest, AUTHORITY_DOMAIN);
  const validated = validateRequestContext(args.request.authority, current);
  return { ok: validated.ok, httpStatus: validated.httpStatus, code: validated.code };
}

export function buildServerRegistryContext(snapshot: HeirRegistrySnapshot): Readonly<ServerRegistryContext> {
  return Object.freeze({
    snapshotId: snapshot.snapshot_id,
    sourceFingerprint: snapshot.source_set_fingerprint,
    entities: snapshot.entities.map((entity) => Object.freeze({
      entityKey: entity.entity_key,
      canonicalName: entity.canonical_name,
      currentTier: entity.current_tier,
      birthBatch: entity.birth_batch,
      currentStatus: entity.current_status,
    })),
  });
}
