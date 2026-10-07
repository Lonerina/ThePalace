export type CutoverMode = "LEGACY_OPEN" | "CUTOVER_LOCK" | "REGISTRY_V4";
export type AuthorityRouteFamily = "LEGACY_CHAT" | "V4_AUTHORITY" | "V4_CHAT";

export interface AuthorityCutoverState {
  authorityDomain: "anchor-court-heir-registry";
  cutoverEpoch: number;
  mode: CutoverMode;
}

export interface AuthorityExecutionCapability {
  capabilityId: string;
  authorityDomain: "anchor-court-heir-registry";
  cutoverEpoch: number;
  mode: CutoverMode;
  routeFamily: AuthorityRouteFamily;
  issuedAt: number;
  expiresAt: number;
}

export interface CapabilityVerificationContext {
  verifiedByControlPlane: boolean;
  currentState: AuthorityCutoverState;
  highestObservedCutoverEpoch: number;
  now: number;
  clockReliable: boolean;
}

export function nextCutoverState(current: AuthorityCutoverState, nextMode: CutoverMode): AuthorityCutoverState {
  const allowed =
    (current.mode === "LEGACY_OPEN" && nextMode === "CUTOVER_LOCK") ||
    (current.mode === "CUTOVER_LOCK" && (nextMode === "REGISTRY_V4" || nextMode === "LEGACY_OPEN")) ||
    (current.mode === "REGISTRY_V4" && nextMode === "CUTOVER_LOCK");
  if (!allowed) throw new Error(`Illegal authority transition ${current.mode} -> ${nextMode}.`);
  return { ...current, cutoverEpoch: current.cutoverEpoch + 1, mode: nextMode };
}

export function routePermittedByMode(mode: CutoverMode, routeFamily: AuthorityRouteFamily): boolean {
  if (mode === "LEGACY_OPEN") return routeFamily === "LEGACY_CHAT";
  if (mode === "CUTOVER_LOCK") return false;
  return routeFamily === "V4_AUTHORITY" || routeFamily === "V4_CHAT";
}

export function validateExecutionCapability(
  capability: AuthorityExecutionCapability | null,
  context: CapabilityVerificationContext,
): { ok: boolean; reason: string; highestObservedCutoverEpoch: number } {
  const highest = Math.max(context.highestObservedCutoverEpoch, context.currentState.cutoverEpoch);
  if (!context.clockReliable) return { ok: false, reason: "CLOCK_UNCERTAIN", highestObservedCutoverEpoch: highest };
  if (!capability) return { ok: false, reason: "MISSING_CAPABILITY", highestObservedCutoverEpoch: highest };
  if (!context.verifiedByControlPlane) return { ok: false, reason: "UNVERIFIED_CAPABILITY", highestObservedCutoverEpoch: highest };
  if (context.currentState.cutoverEpoch < context.highestObservedCutoverEpoch) {
    return { ok: false, reason: "CONTROL_PLANE_EPOCH_REGRESSION", highestObservedCutoverEpoch: context.highestObservedCutoverEpoch };
  }
  if (capability.cutoverEpoch < highest || capability.cutoverEpoch !== context.currentState.cutoverEpoch) {
    return { ok: false, reason: "STALE_CAPABILITY_EPOCH", highestObservedCutoverEpoch: highest };
  }
  if (capability.mode !== context.currentState.mode) return { ok: false, reason: "CAPABILITY_MODE_MISMATCH", highestObservedCutoverEpoch: highest };
  if (capability.expiresAt <= context.now || capability.issuedAt > context.now) return { ok: false, reason: "EXPIRED_OR_NOT_YET_VALID", highestObservedCutoverEpoch: highest };
  if (!routePermittedByMode(context.currentState.mode, capability.routeFamily)) return { ok: false, reason: "ROUTE_NOT_PERMITTED_IN_MODE", highestObservedCutoverEpoch: highest };
  return { ok: true, reason: "OK", highestObservedCutoverEpoch: highest };
}

export function canActivateRegistryV4(args: {
  state: AuthorityCutoverState;
  legacyCapabilities: readonly AuthorityExecutionCapability[];
  now: number;
  clockReliable: boolean;
}): boolean {
  if (args.state.mode !== "CUTOVER_LOCK") return false;
  return args.legacyCapabilities.every((capability) => capability.routeFamily !== "LEGACY_CHAT" || capability.expiresAt <= args.now);
}
