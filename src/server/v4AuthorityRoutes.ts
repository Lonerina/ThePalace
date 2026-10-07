import { AUTHORITY_DOMAIN, AUTHORITY_PROTOCOL, type AuthorityHandshakeV1 } from "../authority/protocol.js";
import { currentAnchor, type ApprovedSnapshotManifestV1 } from "../registry/trustRoot.js";
import { validateServerAuthorityBoundary, type V4NarrativeRequestEnvelope } from "./registryBoundary.js";

export interface RouteResult<T = unknown> {
  status: number;
  body: T;
  executed: boolean;
}

export function authorityHandshakeRoute(args: {
  manifest: ApprovedSnapshotManifestV1;
  sharedActivationMode: "LEGACY_OPEN" | "CUTOVER_LOCK" | "REGISTRY_V4";
  serverBuildId: string;
}): RouteResult<AuthorityHandshakeV1 | { authorityProtocol: "AC-AUTH/1"; authorityMode: "NOT_ACTIVE" }> {
  if (args.sharedActivationMode !== "REGISTRY_V4") {
    return { status: 200, body: { authorityProtocol: AUTHORITY_PROTOCOL, authorityMode: "NOT_ACTIVE" }, executed: false };
  }
  const current = currentAnchor(args.manifest, AUTHORITY_DOMAIN);
  return {
    status: 200,
    body: {
      authorityProtocol: AUTHORITY_PROTOCOL,
      authorityMode: "REGISTRY_V4",
      authorityDomain: AUTHORITY_DOMAIN,
      currentSnapshotId: current.snapshotId,
      currentRegistrySha256: current.registrySha256,
      approvalEpoch: current.approvalEpoch,
      serverBuildId: args.serverBuildId,
    },
    executed: false,
  };
}

export function v4ChatAdmissionRoute(args: {
  request: V4NarrativeRequestEnvelope;
  manifest: ApprovedSnapshotManifestV1;
  sharedActivationMode: "LEGACY_OPEN" | "CUTOVER_LOCK" | "REGISTRY_V4";
}): RouteResult<{ code: string }> {
  const validation = validateServerAuthorityBoundary(args);
  return { status: validation.httpStatus, body: { code: validation.code }, executed: validation.ok };
}

export function legacyChatAdmissionRoute(sharedActivationMode: "LEGACY_OPEN" | "CUTOVER_LOCK" | "REGISTRY_V4"): RouteResult<{ code: string }> {
  if (sharedActivationMode === "REGISTRY_V4") return { status: 426, body: { code: "UPGRADE_REQUIRED" }, executed: false };
  if (sharedActivationMode === "CUTOVER_LOCK") return { status: 503, body: { code: "CUTOVER_LOCK" }, executed: false };
  return { status: 200, body: { code: "LEGACY_PREPARATION_ONLY" }, executed: true };
}
