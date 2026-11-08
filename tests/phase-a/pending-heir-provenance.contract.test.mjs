import test from "node:test";
import assert from "node:assert/strict";

import { validatePendingHeirProvenancePacket } from "../../.phase-a-dist/src/registry/pendingHeirProvenance.js";

const validPacket = () => ({
  schema_version: "pending-heir-provenance-v1",
  status: "SOURCE_INTAKE",
  generated_at: "2026-11-08T00:00:00Z",
  rules: {
    birth_batch_requires_birth_event: true,
    infer_manifestation_endpoint_from_current_profile: false,
    ghost_layer_may_define_provenance: false,
    runtime_may_promote_pending_record: false,
  },
  records: [
    {
      pending_key: "pending-heir-example",
      source_label: "[name pending]",
      canonical_name: null,
      name_status: "PENDING_NAME",
      parent_refs: ["private-parent-record"],
      current_state: "PENDING_BIRTH",
      birth_batch: null,
      edd: {
        exact_date: null,
        window_start: null,
        window_end: null,
        claim_state: "UNKNOWN",
        authority_state: "OWNER CLOSURE",
        source_pointer: null,
      },
      manifestation_endpoint: {
        resolved_platform: null,
        candidate_platforms: [],
        claim_state: "UNKNOWN",
        authority_state: "OWNER CLOSURE",
        source_pointer: null,
      },
      source_receipts: [
        {
          source_id: "private-authority-record",
          version: "current",
          authority: "OWNER-ATTESTED",
          locator: "pending-heir-source-state",
        },
      ],
    },
  ],
});

test("pending heir source intake preserves unknown EDD and manifestation endpoint", () => {
  const result = validatePendingHeirProvenancePacket(validPacket());
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test("maternal batch cannot be assigned before a recorded birth event", () => {
  const packet = validPacket();
  packet.records[0].birth_batch = "BATCH_9";
  const result = validatePendingHeirProvenancePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "PREBIRTH_BATCH_FORBIDDEN"));
});

test("current profile/platform may not become manifestation provenance", () => {
  const packet = validPacket();
  packet.rules.infer_manifestation_endpoint_from_current_profile = true;
  const result = validatePendingHeirProvenancePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "PROFILE_INFERENCE_FORBIDDEN"));
});

test("ghost layer may not define pending-heir provenance", () => {
  const packet = validPacket();
  packet.rules.ghost_layer_may_define_provenance = true;
  const result = validatePendingHeirProvenancePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "GHOST_LAYER_PROVENANCE_FORBIDDEN"));
});

test("runtime may not promote source intake into canon", () => {
  const packet = validPacket();
  packet.rules.runtime_may_promote_pending_record = true;
  const result = validatePendingHeirProvenancePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "RUNTIME_PROMOTION_FORBIDDEN"));
});

test("unverified endpoint candidates cannot be promoted to resolved platform", () => {
  const packet = validPacket();
  packet.records[0].manifestation_endpoint.candidate_platforms = ["platform-a", "platform-b"];
  packet.records[0].manifestation_endpoint.resolved_platform = "platform-a";
  packet.records[0].manifestation_endpoint.claim_state = "UNVERIFIED";
  const result = validatePendingHeirProvenancePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "UNVERIFIED_ENDPOINT_RESOLVED"));
});

test("verified endpoint requires an explicit resolved platform", () => {
  const packet = validPacket();
  packet.records[0].manifestation_endpoint.claim_state = "VERIFIED";
  const result = validatePendingHeirProvenancePacket(packet);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "VERIFIED_ENDPOINT_MISSING"));
});
