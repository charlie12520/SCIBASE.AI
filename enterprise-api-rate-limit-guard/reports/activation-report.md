# Enterprise API Rate-Limit Contract Guard Report

Status: hold_integrations

Audit digest: `273861e84d3746b64d6560e9f717e1607a7cc0975bbc0825b0ec2b5336039eb3`

## Summary

- Integrations checked: 4
- Ready to release: 1
- Needs review: 1
- Held: 2
- Blockers: 11
- Warnings: 12

## Activation Decisions

| Integration | Status | Blockers | Warnings | Contract RPM | Provisioned RPM |
| --- | --- | ---: | ---: | ---: | ---: |
| api-invenio-release | release | 0 | 0 | 600 | 500 |
| api-biocore-overlimit | hold | 10 | 8 | 300 | 900 |
| api-canvas-passback-hold | hold | 1 | 3 | 200 | 175 |
| api-moodle-review | review | 0 | 1 | 150 | 100 |

## Remediation Actions

- api-biocore-overlimit: Add an escalation contact for rate-limit or webhook incident response.
- api-biocore-overlimit: Lower sustained requests per minute to 300 or execute an amended contract.
- api-biocore-overlimit: Lower burst requests per minute to 600 or execute an amended contract.
- api-biocore-overlimit: Lower daily export records to 10000 or execute an amended contract.
- api-biocore-overlimit: Lower concurrent export jobs to 2 or execute an amended contract.
- api-biocore-overlimit: Remove uncontracted endpoints or amend the integration scope.
- api-biocore-overlimit: Remove unapproved export targets or attach sponsor approval.
- api-biocore-overlimit: Require Retry-After handling before production API key activation.
- api-biocore-overlimit: Switch the integration to Retry-After or exponential jitter backoff.
- api-biocore-overlimit: Require idempotency keys for write/create/delete endpoints.
- api-biocore-overlimit: Add an institutional IP allowlist before enabling private project access.
- api-biocore-overlimit: Generate an admin dashboard review packet for private project access.
- api-biocore-overlimit: Use HMAC-SHA256 or HMAC-SHA512 for webhook event signing.
- api-biocore-overlimit: Record webhook secret rotation evidence before production activation.
- api-biocore-overlimit: Configure a dead-letter queue for failed webhook deliveries.
- api-biocore-overlimit: Cap webhook retries at 8 attempts with jitter.
- api-biocore-overlimit: Attach sandbox load-test evidence for the contracted limits.
- api-biocore-overlimit: Add an admin dashboard tag or cost center for usage attribution.
- api-canvas-passback-hold: Require idempotency keys for write/create/delete endpoints.
- api-canvas-passback-hold: Rotate the webhook signing secret before production activation.
- api-canvas-passback-hold: Configure a dead-letter queue for failed webhook deliveries.
- api-canvas-passback-hold: Refresh sandbox load-test evidence before production activation.
- api-moodle-review: Add an admin dashboard tag or cost center for usage attribution.
