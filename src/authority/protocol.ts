import type { ApprovedSnapshotAnchor } from "../registry/trustRoot.js";

export const AUTHORITY_PROTOCOL = "AC-AUTH/1" as const;
export const AUTHORITY_DOMAIN = "anchor-court-heir-registry" as const;

export type RuntimeAuthorityMode = "LEGACY_V3" | "REGISTRY_V4";

export interface AuthorityHandshakeV1 {
  authorityProtocol: typeof AUTHORITY_PROTOCOL;
  authorityMode: "REGISTRY_V4";
  authorityDomain: typeof AUTHORITY_DOMAIN;
  currentSnapshotId: string;
  currentRegistrySha256: string;
  approvalEpoch: number;
  serverBuildId: string;
}

export interface AuthorityRequestContextV1 {
  authorityProtocol: typeof AUTHORITY_PROTOCOL;
  authorityDomain: typeof AUTHORITY_DOMAIN;
  snapshotId: string;
  registrySha256: string;
  approvalEpoch: number;
}

export interface AuthorityValidationResult {
  ok: boolean;
  code: "OK" | "UNSUPPORTED_PROTOCOL" | "AUTHORITY_MODE_INACTIVE" | "AUTHORITY_VERSION_MISMATCH" | "LEGACY_STRUCTURAL_PAYLOAD_REJECTED";
  httpStatus: number;
}

export function validateRequestContext(
  context: AuthorityRequestContextV1,
  current: ApprovedSnapshotAnchor,
): AuthorityValidationResult {
  if (context.authorityProtocol !== AUTHORITY_PROTOCOL || context.authorityDomain !== AUTHORITY_DOMAIN) {
    return { ok: false, code: "UNSUPPORTED_PROTOCOL", httpStatus: 426 };
  }
  if (
    context.snapshotId !== current.snapshotId ||
    context.registrySha256 !== current.registrySha256 ||
    context.approvalEpoch !== current.approvalEpoch ||
    current.lifecycle !== "CURRENT"
  ) {
    return { ok: false, code: "AUTHORITY_VERSION_MISMATCH", httpStatus: 409 };
  }
  return { ok: true, code: "OK", httpStatus: 200 };
}

export function handshakeMatchesCurrent(handshake: AuthorityHandshakeV1, current: ApprovedSnapshotAnchor): boolean {
  return handshake.authorityProtocol === AUTHORITY_PROTOCOL &&
    handshake.authorityMode === "REGISTRY_V4" &&
    handshake.authorityDomain === AUTHORITY_DOMAIN &&
    handshake.currentSnapshotId === current.snapshotId &&
    handshake.currentRegistrySha256 === current.registrySha256 &&
    handshake.approvalEpoch === current.approvalEpoch;
}

export const V4_ENDPOINTS = Object.freeze({
  authority: "/api/v4/authority",
  chat: "/api/v4/game/chat",
  legacyChat: "/api/game/chat",
});

export function decideV4ClientRouting(
  handshake: AuthorityHandshakeV1 | null,
  current: ApprovedSnapshotAnchor,
): { mode: "REGISTRY_V4" | "RUNTIME_ONLY"; chatEndpoint: "/api/v4/game/chat" | null; legacyFallback: false } {
  if (!handshake || !handshakeMatchesCurrent(handshake, current)) {
    return { mode: "RUNTIME_ONLY", chatEndpoint: null, legacyFallback: false };
  }
  return { mode: "REGISTRY_V4", chatEndpoint: V4_ENDPOINTS.chat, legacyFallback: false };
}
