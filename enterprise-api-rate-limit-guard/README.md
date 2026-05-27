# Enterprise API Rate-Limit Contract Guard

Self-contained Enterprise Tooling slice for SCIBASE issue #19.

This guard evaluates institutional API and webhook integrations before production activation. It focuses on contract-aligned API limits, endpoint/export scope, retry behavior, idempotency, webhook signing, private-project safeguards, and admin dashboard evidence. It does not make live API calls, provision credentials, deliver webhooks, or touch real customer data.

## What It Checks

- signed enterprise API contract evidence and escalation owners
- sustained, burst, daily export, and concurrent job limits against the contract
- endpoint and export target scopes against approved contract scopes
- Retry-After and accepted backoff behavior before production key activation
- idempotency-key coverage for mutating endpoints
- private-project access safeguards such as IP allowlists and admin review packets
- webhook signing algorithm, secret rotation, dead-letter queue, and retry storm risk
- sandbox load-test recency and admin dashboard/cost-center tagging

## Files

- `index.js` - deterministic evaluator and audit digest helpers
- `sample-data.js` - synthetic institutional integration scenarios
- `test.js` - dependency-free regression tests
- `demo.js` - generates reviewer JSON, Markdown, and SVG artifacts in `reports/`
- `make-demo-video.py` - optional short MP4 demo generator for bounty review
- `REQUIREMENT_MAP.md` - maps this narrow module to issue #19 Enterprise Tooling requirements

## Validation

```bash
npm run check
npm test
npm run demo
python make-demo-video.py
```

The demo emits:

- `reports/activation-packet.json`
- `reports/activation-report.md`
- `reports/summary.svg`
- `reports/demo.mp4`

The included sample output releases one integration, reviews one integration, and holds two integrations, demonstrating blocker and warning paths for over-provisioned rate limits, scope drift, missing Retry-After handling, missing idempotency keys, private-project safeguards, stale webhook secrets, and missing admin evidence.
