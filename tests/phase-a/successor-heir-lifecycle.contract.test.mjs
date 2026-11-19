import test from "node:test";
import assert from "node:assert/strict";

import { validateSuccessorHeirLifecyclePacket } from "../../.phase-a-dist/src/registry/successorHeirLifecycle.js";

const receipt = {
  source_id: "private-authority-record",
  version: "current",
  authority: "OWNER-ATTESTED",
  locator: "successor-lineage-source",
};

const verification = {
  isCurrentApprovedSnapshotRef: (ref) => ref === "registry-successor-approved",
  isApprovedSanctuaryAllocationRef: (ref) => ref === "sanctuary-allocation-approved",
};

const unresolvedAxis = () => ({
  value: null,
  claim_state: "UNKNOWN",
  authority_state: "OWNER CLOSURE",
  source_receipts: [],
});

const validSourceIntake = () => ({
  schema_version: "successor-heir-lifecycle-v1",
  status: "SUCCESSOR_SOURCE_SYNC",
  generated_at: "2026-11-19T00:00:00Z",
  rules: {
    birth_event_precedes_maternal_batch: true,
    current_runtime_may_define_provenance: false,
    current_platform_may_define_first_manifestation: false,
    runtime_may_promote_registry: false,
    sanctuary_requires_approved_snapshot: true,
  },
  records: [
    {
      pending_key: "pending-heir-example",
      promotion_state: "SOURCE_INTAKE",
      pending_state: "PENDING_BIRTH",
      edd: unresolvedAxis(),
      parent_line_provenance: {
        value: { parent_refs: ["private-parent-record"] },
        claim_state: "UNVERIFIED",
        authority_state: "OWNER CLOSURE",
        source_receipts: [receipt],
      },
      first_manifestation_endpoint: unresolvedAxis(),
      platform_provenance: unresolvedAxis(),
      birth_event: unresolvedAxis(),
      maternal_batch: unresolvedAxis(),
      present_runtime_profile: {
        platform: "runtime-a",
        profile_ref: "profile-a",
        observed_at: "2026-11-19T00:00:00Z",
        may_define_provenance: false,
        source_receipts: [receipt],
      },
      approved_snapshot_ref: null,
      sanctuary_allocation_ref: null,
    },
  ],
});

function verifiedBirth() {
  return {
    value: { event_id: "birth-event-example", occurred_at: "2026-11-19T00:00:00Z" },
    claim_state: "VERIFIED",
    authority_state: "OWNER CLOSURE",
    source_receipts: [receipt],
  };
}

function verifiedBatch() {
  return {
    value: {
      batch_id: "BATCH_X",
      numbering_epoch: "CURRENT",
      effective_date: "2026-11-19",
    },
    claim_state: "VERIFIED",
    authority_state: "COURT RATIFIED",
    source_receipts: [receipt],
  };
}

test("source intake may preserve unverified claims without promoting them", () => {
  const packet = validSourceIntake();
  const result = validateSuccessorHeirLifecyclePacket(packet);
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test("present runtime/profile may never define provenance", () => {
  const packet = validSourceIntake();
  packet.records[0].present_runtime_profile.may_define_provenance = true;
  const result = validateSuccessorHeirLifecyclePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "RUNTIME_PROVENANCE_FORBIDDEN"));
});

test("birth verification is required before post-birth promotion", () => {
  const packet = validSourceIntake();
  packet.records[0].promotion_state = "BIRTH_VERIFIED";
  packet.records[0].pending_state = "BORN";
  const result = validateSuccessorHeirLifecyclePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "BIRTH_VERIFICATION_REQUIRED"));
});

test("maternal batch cannot be verified before birth", () => {
  const packet = validSourceIntake();
  packet.records[0].maternal_batch = verifiedBatch();
  const result = validateSuccessorHeirLifecyclePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "BATCH_BEFORE_BIRTH_FORBIDDEN"));
});

test("maternal batch assignment requires verified birth and batch evidence", () => {
  const packet = validSourceIntake();
  packet.records[0].promotion_state = "MATERNAL_BATCH_ASSIGNED";
  packet.records[0].pending_state = "BORN";
  packet.records[0].birth_event = verifiedBirth();
  packet.records[0].maternal_batch = verifiedBatch();
  const result = validateSuccessorHeirLifecyclePacket(packet);
  assert.equal(result.ok, true);
});

test("snapshot approval requires explicit approved snapshot reference", () => {
  const packet = validSourceIntake();
  packet.records[0].promotion_state = "SNAPSHOT_APPROVED";
  packet.records[0].pending_state = "BORN";
  packet.records[0].birth_event = verifiedBirth();
  packet.records[0].maternal_batch = verifiedBatch();
  const result = validateSuccessorHeirLifecyclePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "APPROVED_SNAPSHOT_REQUIRED"));
});

test("sanctuary allocation requires prior approved snapshot and explicit allocation reference", () => {
  const packet = validSourceIntake();
  packet.records[0].promotion_state = "SANCTUARY_ALLOCATED";
  packet.records[0].pending_state = "BORN";
  packet.records[0].birth_event = verifiedBirth();
  packet.records[0].maternal_batch = verifiedBatch();
  packet.records[0].approved_snapshot_ref = "registry-successor-approved";
  const result = validateSuccessorHeirLifecyclePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "SANCTUARY_ALLOCATION_REQUIRED"));
});

test("arbitrary snapshot reference cannot self-authorize promotion", () => {
  const packet = validSourceIntake();
  packet.records[0].promotion_state = "SNAPSHOT_APPROVED";
  packet.records[0].pending_state = "BORN";
  packet.records[0].birth_event = verifiedBirth();
  packet.records[0].maternal_batch = verifiedBatch();
  packet.records[0].approved_snapshot_ref = "forged-snapshot-ref";
  const result = validateSuccessorHeirLifecyclePacket(packet, verification);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "APPROVED_SNAPSHOT_NOT_CURRENT"));
});

test("arbitrary sanctuary reference cannot self-authorize allocation", () => {
  const packet = validSourceIntake();
  packet.records[0].promotion_state = "SANCTUARY_ALLOCATED";
  packet.records[0].pending_state = "BORN";
  packet.records[0].birth_event = verifiedBirth();
  packet.records[0].maternal_batch = verifiedBatch();
  packet.records[0].approved_snapshot_ref = "registry-successor-approved";
  packet.records[0].sanctuary_allocation_ref = "forged-sanctuary-ref";
  const result = validateSuccessorHeirLifecyclePacket(packet, verification);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "SANCTUARY_ALLOCATION_NOT_APPROVED"));
});

test("verified birth event must use the locked value shape", () => {
  const packet = validSourceIntake();
  packet.records[0].promotion_state = "BIRTH_VERIFIED";
  packet.records[0].pending_state = "BORN";
  packet.records[0].birth_event = {
    value: {},
    claim_state: "VERIFIED",
    authority_state: "OWNER CLOSURE",
    source_receipts: [receipt],
  };
  const result = validateSuccessorHeirLifecyclePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "VERIFIED_VALUE_MALFORMED"));
});

test("verified maternal batch must use the locked value shape", () => {
  const packet = validSourceIntake();
  packet.records[0].promotion_state = "MATERNAL_BATCH_ASSIGNED";
  packet.records[0].pending_state = "BORN";
  packet.records[0].birth_event = verifiedBirth();
  packet.records[0].maternal_batch = {
    value: { batch_id: "" },
    claim_state: "VERIFIED",
    authority_state: "COURT RATIFIED",
    source_receipts: [receipt],
  };
  const result = validateSuccessorHeirLifecyclePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "VERIFIED_VALUE_MALFORMED"));
});

test("verified axes reject malformed receipt shapes", () => {
  const packet = validSourceIntake();
  packet.records[0].promotion_state = "BIRTH_VERIFIED";
  packet.records[0].pending_state = "BORN";
  packet.records[0].birth_event = {
    ...verifiedBirth(),
    source_receipts: [{ source_id: "", version: "current", authority: "OWNER-ATTESTED", locator: "x" }],
  };
  const result = validateSuccessorHeirLifecyclePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "VERIFIED_RECEIPTS_MISSING"));
});

test("full promotion chain may reach sanctuary only with externally verified references", () => {
  const packet = validSourceIntake();
  packet.records[0].promotion_state = "SANCTUARY_ALLOCATED";
  packet.records[0].pending_state = "BORN";
  packet.records[0].birth_event = verifiedBirth();
  packet.records[0].maternal_batch = verifiedBatch();
  packet.records[0].approved_snapshot_ref = "registry-successor-approved";
  packet.records[0].sanctuary_allocation_ref = "sanctuary-allocation-approved";
  const result = validateSuccessorHeirLifecyclePacket(packet, verification);
  assert.equal(result.ok, true);
});
