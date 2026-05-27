const assert = require("node:assert/strict");
const { evaluatePortfolio, evaluateRenewal, stableDigest } = require("./index");
const { sampleRenewals } = require("./sample-data");

function issueCodes(result) {
  return [...result.blockers, ...result.warnings].map((issue) => issue.code);
}

const ready = evaluateRenewal(sampleRenewals[0]);
assert.equal(ready.status, "release");
assert.equal(ready.blockers.length, 0);

const latePrice = evaluateRenewal(sampleRenewals[1]);
assert.equal(latePrice.status, "hold");
assert.ok(issueCodes(latePrice).includes("short_notice_window"));
assert.ok(issueCodes(latePrice).includes("missing_price_change_summary"));
assert.ok(issueCodes(latePrice).includes("late_price_change_notice"));

const institutional = evaluateRenewal(sampleRenewals[2]);
assert.equal(institutional.status, "hold");
assert.ok(issueCodes(institutional).includes("missing_po_approval"));
assert.ok(issueCodes(institutional).includes("missing_seat_usage_summary"));
assert.ok(issueCodes(institutional).includes("missing_procurement_contact"));

const trial = evaluateRenewal(sampleRenewals[3]);
assert.equal(trial.status, "hold");
assert.ok(issueCodes(trial).includes("missing_cancellation_link"));
assert.ok(issueCodes(trial).includes("missing_trial_conversion_notice"));

const portfolio = evaluatePortfolio(sampleRenewals);
assert.equal(portfolio.status, "hold_renewals");
assert.equal(portfolio.metrics.totalRenewals, 4);
assert.equal(portfolio.metrics.release, 1);
assert.equal(portfolio.metrics.hold, 3);
assert.ok(portfolio.auditDigest.length === 64);
assert.equal(portfolio.auditDigest, evaluatePortfolio(sampleRenewals).auditDigest);

assert.equal(stableDigest({ b: 1, a: 2 }), stableDigest({ a: 2, b: 1 }));

console.log("subscription-renewal-notice-guard tests passed");
