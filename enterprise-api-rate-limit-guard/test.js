const assert = require("node:assert/strict");
const { DEFAULT_POLICY, evaluateIntegration, evaluatePortfolio, stableDigest } = require("./index");
const { sampleIntegrations } = require("./sample-data");

function issueCodes(result) {
  return [...result.blockers, ...result.warnings].map((issue) => issue.code);
}

const ready = evaluateIntegration(sampleIntegrations[0]);
assert.equal(ready.status, "release");
assert.equal(ready.blockers.length, 0);
assert.equal(ready.warnings.length, 0);

const overLimit = evaluateIntegration(sampleIntegrations[1]);
assert.equal(overLimit.status, "hold");
assert.ok(issueCodes(overLimit).includes("provisioned_sustained_over_contract"));
assert.ok(issueCodes(overLimit).includes("provisioned_burst_over_contract"));
assert.ok(issueCodes(overLimit).includes("endpoint_scope_exceeds_contract"));
assert.ok(issueCodes(overLimit).includes("export_target_exceeds_contract"));
assert.ok(issueCodes(overLimit).includes("missing_retry_after_enforcement"));
assert.ok(issueCodes(overLimit).includes("weak_webhook_signing"));
assert.ok(issueCodes(overLimit).includes("missing_ip_allowlist"));

const canvas = evaluateIntegration(sampleIntegrations[2]);
assert.equal(canvas.status, "hold");
assert.ok(issueCodes(canvas).includes("missing_idempotency_keys"));
assert.ok(issueCodes(canvas).includes("stale_webhook_secret"));
assert.ok(issueCodes(canvas).includes("missing_dead_letter_queue"));
assert.ok(issueCodes(canvas).includes("stale_load_test"));

const moodle = evaluateIntegration(sampleIntegrations[3]);
assert.equal(moodle.status, "review");
assert.ok(issueCodes(moodle).includes("missing_dashboard_tag"));

const customBackoffPolicy = evaluateIntegration(sampleIntegrations[3], {
  ...DEFAULT_POLICY,
  acceptedBackoffModes: ["custom_enterprise_backoff"],
});
assert.ok(issueCodes(customBackoffPolicy).includes("weak_backoff_mode"));

const staleSecretPolicy = evaluateIntegration(sampleIntegrations[0], {
  ...DEFAULT_POLICY,
  now: "2027-01-01T00:00:00.000Z",
});
assert.equal(staleSecretPolicy.status, "review");
assert.ok(issueCodes(staleSecretPolicy).includes("stale_webhook_secret"));

const portfolio = evaluatePortfolio(sampleIntegrations);
assert.equal(portfolio.status, "hold_integrations");
assert.equal(portfolio.metrics.totalIntegrations, 4);
assert.equal(portfolio.metrics.release, 1);
assert.equal(portfolio.metrics.review, 1);
assert.equal(portfolio.metrics.hold, 2);
assert.ok(portfolio.auditDigest.length === 64);
assert.equal(portfolio.auditDigest, evaluatePortfolio(sampleIntegrations).auditDigest);

assert.equal(stableDigest({ b: 1, a: 2 }), stableDigest({ a: 2, b: 1 }));

console.log("enterprise-api-rate-limit-guard tests passed");
