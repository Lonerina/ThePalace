import type { BalloonSanctuaryState } from "../consumers/balloonRegistry.js";
import type {
  SuccessorHeirLifecycleRecord,
  SuccessorLifecycleVerificationContext,
} from "../registry/successorHeirLifecycle.js";
import {
  currentAnchor,
  type ApprovedSnapshotManifestV1,
} from "../registry/trustRoot.js";
import type { SourceReceipt } from "../registry/types.js";

export interface ApprovedSuccessorSanctuaryAllocation {
  allocationRef: string;
  pendingKey: string;
  entityKey: string;
  chamberId: string;
  registrySnapshotId: string;
  approvalReceipts: SourceReceipt[];
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validReceipt(value: SourceReceipt): boolean {
  return nonEmptyString(value.source_id) &&
    nonEmptyString(value.version) &&
    nonEmptyString(value.authority) &&
    nonEmptyString(value.locator);
}

export function buildSuccessorLifecycleVerificationContext(args: {
  manifest: ApprovedSnapshotManifestV1;
  authorityDomain: string;
  sanctuaryState: BalloonSanctuaryState;
  approvedSanctuaryAllocations: readonly ApprovedSuccessorSanctuaryAllocation[];
}): SuccessorLifecycleVerificationContext {
  const current = currentAnchor(args.manifest, args.authorityDomain);

  return Object.freeze({
    isCurrentApprovedSnapshotRef(
      ref: string,
      _record: SuccessorHeirLifecycleRecord,
    ): boolean {
      return ref === current.snapshotId;
    },

    isApprovedSanctuaryAllocationRef(
      ref: string,
      record: SuccessorHeirLifecycleRecord,
    ): boolean {
      if (record.approved_snapshot_ref !== current.snapshotId) return false;
      if (args.sanctuaryState.registrySnapshotId !== current.snapshotId) return false;

      const approval = args.approvedSanctuaryAllocations.find((candidate) =>
        candidate.allocationRef === ref &&
        candidate.pendingKey === record.pending_key &&
        candidate.registrySnapshotId === current.snapshotId,
      );
      if (!approval) return false;
      if (!approval.approvalReceipts.length || !approval.approvalReceipts.every(validReceipt)) return false;

      const chamber = args.sanctuaryState.chambers.find((candidate) =>
        candidate.chamber_id === approval.chamberId,
      );
      if (!chamber || chamber.slot_state !== "BOUND" || !chamber.binding) return false;

      return chamber.binding.entity_key === approval.entityKey &&
        chamber.binding.registry_snapshot_id === current.snapshotId;
    },
  });
}
