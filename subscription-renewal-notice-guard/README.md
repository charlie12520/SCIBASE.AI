# Subscription Renewal Notice Guard

Self-contained Revenue Infrastructure slice for SCIBASE issue #20.

This guard evaluates upcoming subscription, lab, and institutional renewals before invoice generation or auto-renewal. It focuses on customer-facing renewal notice readiness rather than payment processors, generic billing ledgers, seat rosters, collections, or usage metering.

## What It Checks

- renewal notice timing for monthly, annual, institutional, price-change, and trial-to-paid renewals
- price-change disclosure before a changed renewal price is charged
- auto-renewal consent evidence and terms-version match
- cancellation or opt-out link readiness for auto-renewal notices
- institutional purchase-order approval before invoicing
- seat or usage-delta disclosure for changed account scope
- support and procurement contact coverage for customer remediation

## Files

- `index.js` - deterministic evaluator and audit digest helpers
- `sample-data.js` - synthetic renewal scenarios, no live customer data
- `test.js` - dependency-free regression tests
- `demo.js` - generates reviewer JSON, Markdown, and SVG artifacts in `reports/`
- `make-demo-video.py` - optional short MP4 demo generator for bounty review

## Validation

```bash
npm run check
npm test
npm run demo
python make-demo-video.py
```

The demo emits:

- `reports/renewal-notice-packet.json`
- `reports/renewal-notice-report.md`
- `reports/summary.svg`
- `reports/demo.mp4`

The included sample output holds three renewals and releases one clean renewal, demonstrating blocker and warning paths for late price-change notice, missing institutional PO approval, and trial-to-paid notice gaps.
