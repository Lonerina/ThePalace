import {
  routePermittedByMode,
  validateExecutionCapability,
  type AuthorityCutoverState,
  type AuthorityExecutionCapability,
  type AuthorityRouteFamily,
} from "./controlPlane.js";

export interface GatewayPolicyV1 {
  schemaVersion: "authority-gateway-policy-v1";
  authorityDomain: "anchor-court-heir-registry";
  directOriginAccess: "DENY";
  v4UpstreamRequiresProtocol: "AC-AUTH/1";
  modes: Record<"LEGACY_OPEN" | "CUTOVER_LOCK" | "REGISTRY_V4", {
    legacyChat: "ALLOW_LEGACY_POOL" | "DENY";
    v4Authority: "READINESS_ONLY" | "ALLOW_V4_POOL";
    v4Chat: "DENY" | "ALLOW_V4_POOL";
  }>;
}

export interface UpstreamDescriptor {
  id: string;
  protocol: "AC-AUTH/1" | "LEGACY_V3";
}

export function validateGatewayPolicy(policy: GatewayPolicyV1): void {
  if (policy.directOriginAccess !== "DENY") throw new Error("Authority origin bypass must be denied.");
  if (policy.v4UpstreamRequiresProtocol !== "AC-AUTH/1") throw new Error("v4 upstreams must require AC-AUTH/1.");
  if (policy.modes.CUTOVER_LOCK.legacyChat !== "DENY" || policy.modes.CUTOVER_LOCK.v4Chat !== "DENY") {
    throw new Error("CUTOVER_LOCK must deny both executable authority route families.");
  }
  if (policy.modes.REGISTRY_V4.legacyChat !== "DENY" || policy.modes.REGISTRY_V4.v4Chat !== "ALLOW_V4_POOL") {
    throw new Error("REGISTRY_V4 must fence legacy chat and permit only v4 chat pool.");
  }
  if (policy.modes.LEGACY_OPEN.legacyChat !== "ALLOW_LEGACY_POOL" || policy.modes.LEGACY_OPEN.v4Chat !== "DENY") {
    throw new Error("LEGACY_OPEN must not execute v4 chat.");
  }
}

export function validateV4UpstreamPool(upstreams: readonly UpstreamDescriptor[]): void {
  if (upstreams.some((upstream) => upstream.protocol !== "AC-AUTH/1")) throw new Error("Old binary present in v4 upstream pool.");
}

export function gatewayAdmit(args: {
  routeFamily: AuthorityRouteFamily;
  state: AuthorityCutoverState | null;
  capability: AuthorityExecutionCapability | null;
  capabilityVerifiedByControlPlane: boolean;
  highestObservedCutoverEpoch: number;
  now: number;
  controlPlaneReachable: boolean;
  clockReliable?: boolean;
}): { allow: boolean; reason: string; highestObservedCutoverEpoch: number } {
  if (!args.controlPlaneReachable || !args.state) {
    return { allow: false, reason: "CONTROL_PLANE_UNAVAILABLE", highestObservedCutoverEpoch: args.highestObservedCutoverEpoch };
  }
  if (!routePermittedByMode(args.state.mode, args.routeFamily)) {
    return { allow: false, reason: "ROUTE_DENIED_BY_MODE", highestObservedCutoverEpoch: Math.max(args.highestObservedCutoverEpoch, args.state.cutoverEpoch) };
  }
  const validated = validateExecutionCapability(args.capability, {
    verifiedByControlPlane: args.capabilityVerifiedByControlPlane,
    currentState: args.state,
    highestObservedCutoverEpoch: args.highestObservedCutoverEpoch,
    now: args.now,
    clockReliable: args.clockReliable ?? true,
  });
  return { allow: validated.ok, reason: validated.reason, highestObservedCutoverEpoch: validated.highestObservedCutoverEpoch };
}
