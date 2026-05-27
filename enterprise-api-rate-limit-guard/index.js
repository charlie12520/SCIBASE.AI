const crypto = require("node:crypto");

const DEFAULT_POLICY = Object.freeze({
  now: "2026-05-27T12:00:00.000Z",
  staleLoadTestDays: 90,
  maxWebhookSecretAgeDays: 180,
  maxWebhookRetryAttempts: 8,
  acceptedSigningAlgorithms: ["hmac-sha256", "hmac-sha512"],
  acceptedBackoffModes: ["retry_after", "exponential_jitter"],
});

function evaluatePortfolio(integrations, policy = DEFAULT_POLICY) {
  const evaluated = integrations.map((integration) => evaluateIntegration(integration, policy));
  const blockers = evaluated.flatMap((item) => item.blockers);
  const warnings = evaluated.flatMap((item) => item.warnings);
  const metrics = buildMetrics(evaluated);
  const status = blockers.length > 0 ? "hold_integrations" : warnings.length > 0 ? "review_integrations" : "ready";
  const payload = {
    generatedAt: policy.now,
    status,
    metrics,
    integrations: evaluated,
  };

  return {
    ...payload,
    auditDigest: stableDigest(payload),
  };
}

function evaluateIntegration(integration, policy = DEFAULT_POLICY) {
  const blockers = [];
  const warnings = [];
  const actions = [];
  const contract = integration.contract || {};
  const config = integration.productionConfig || {};
  const safeguards = integration.safeguards || {};
  const evidence = integration.evidence || {};

  checkContractOwners(integration, blockers, warnings, actions);
  checkRateContract(integration, contract, config, blockers, actions);
  checkScopes(integration, contract, config, blockers, actions);
  checkRateBehavior(integration, policy, config, blockers, warnings, actions);
  checkPrivateProjectSafeguards(integration, config, safeguards, blockers, warnings, actions);
  checkWebhookReadiness(integration, policy, blockers, warnings, actions);
  checkEvidence(integration, policy, evidence, warnings, actions);

  const status = blockers.length > 0 ? "hold" : warnings.length > 0 ? "review" : "release";
  return {
    id: integration.id,
    name: integration.name,
    institution: integration.institution,
    integrationType: integration.integrationType,
    status,
    contractedSustainedRpm: numberOrNull(contract.sustainedRpm),
    provisionedSustainedRpm: numberOrNull(config.sustainedRpm),
    contractedBurstRpm: numberOrNull(contract.burstRpm),
    provisionedBurstRpm: numberOrNull(config.burstRpm),
    blockers,
    warnings,
    actions: [...new Set(actions)],
    auditDigest: stableDigest({ integration, status, blockers, warnings }),
  };
}

function checkContractOwners(integration, blockers, warnings, actions) {
  const contract = integration.contract || {};
  if (!contract.signedAt) {
    addIssue(blockers, integration, "missing_signed_contract", "No signed enterprise API contract is attached.");
    actions.push("Attach the signed integration contract before production activation.");
  }
  if (!contract.ownerContact) {
    addIssue(warnings, integration, "missing_owner_contact", "Contract has no named institutional owner.");
    actions.push("Add an institutional owner contact for limit-change and outage decisions.");
  }
  if (!contract.escalationContact) {
    addIssue(warnings, integration, "missing_escalation_contact", "Contract has no escalation contact.");
    actions.push("Add an escalation contact for rate-limit or webhook incident response.");
  }
}

function checkRateContract(integration, contract, config, blockers, actions) {
  // Provisioned limits are compared against the signed contract before API keys
  // or webhook routes move from sandbox into production.
  compareLimit(
    integration,
    blockers,
    actions,
    "sustainedRpm",
    contract.sustainedRpm,
    config.sustainedRpm,
    "provisioned_sustained_over_contract",
    "sustained requests per minute",
  );
  compareLimit(
    integration,
    blockers,
    actions,
    "burstRpm",
    contract.burstRpm,
    config.burstRpm,
    "provisioned_burst_over_contract",
    "burst requests per minute",
  );
  compareLimit(
    integration,
    blockers,
    actions,
    "dailyExportLimit",
    contract.dailyExportLimit,
    config.dailyExportLimit,
    "provisioned_daily_export_over_contract",
    "daily export records",
  );
  compareLimit(
    integration,
    blockers,
    actions,
    "concurrentJobs",
    contract.concurrentJobs,
    config.concurrentJobs,
    "provisioned_concurrency_over_contract",
    "concurrent export jobs",
  );
}

function compareLimit(integration, blockers, actions, field, contracted, provisioned, code, label) {
  if (provisioned == null) {
    addIssue(blockers, integration, `missing_${field}`, `Production config is missing ${label}.`);
    actions.push(`Set ${label} in production config before activation.`);
    return;
  }
  if (contracted == null) {
    addIssue(blockers, integration, `missing_contract_${field}`, `Contract is missing ${label}.`);
    actions.push(`Add contracted ${label} to the integration order form.`);
    return;
  }
  if (Number(provisioned) > Number(contracted)) {
    addIssue(
      blockers,
      integration,
      code,
      `Provisioned ${label} ${provisioned} exceeds contract limit ${contracted}.`,
    );
    actions.push(`Lower ${label} to ${contracted} or execute an amended contract.`);
  }
}

function checkScopes(integration, contract, config, blockers, actions) {
  const requestedEndpoints = config.endpoints || [];
  const allowedEndpoints = new Set(contract.allowedEndpoints || []);
  const extraEndpoints = requestedEndpoints.filter((endpoint) => !allowedEndpoints.has(endpoint));
  if (extraEndpoints.length > 0) {
    addIssue(
      blockers,
      integration,
      "endpoint_scope_exceeds_contract",
      `Requested endpoints exceed contract scope: ${extraEndpoints.join(", ")}.`,
    );
    actions.push("Remove uncontracted endpoints or amend the integration scope.");
  }

  const requestedTargets = config.exportTargets || [];
  const allowedTargets = new Set(contract.allowedExportTargets || []);
  const extraTargets = requestedTargets.filter((target) => !allowedTargets.has(target));
  if (extraTargets.length > 0) {
    addIssue(
      blockers,
      integration,
      "export_target_exceeds_contract",
      `Requested export targets exceed contract scope: ${extraTargets.join(", ")}.`,
    );
    actions.push("Remove unapproved export targets or attach sponsor approval.");
  }
}

function checkRateBehavior(integration, policy, config, blockers, warnings, actions) {
  const mutatingEndpoints = (config.endpoints || []).filter((endpoint) => /\.write$|\.delete$|\.create$/.test(endpoint));
  if (!config.enforcesRetryAfter) {
    addIssue(blockers, integration, "missing_retry_after_enforcement", "Client is not configured to honor Retry-After.");
    actions.push("Require Retry-After handling before production API key activation.");
  }
  if (!policy.acceptedBackoffModes.includes(config.backoffMode)) {
    addIssue(warnings, integration, "weak_backoff_mode", "Backoff mode is not an accepted rate-limit strategy.");
    actions.push("Switch the integration to Retry-After or exponential jitter backoff.");
  }
  if (mutatingEndpoints.length > 0 && !config.requiresIdempotencyKey) {
    addIssue(blockers, integration, "missing_idempotency_keys", "Mutating endpoints lack idempotency-key enforcement.");
    actions.push("Require idempotency keys for write/create/delete endpoints.");
  }
}

function checkPrivateProjectSafeguards(integration, config, safeguards, blockers, warnings, actions) {
  if (!config.privateProjectAccess) return;

  if (!Array.isArray(safeguards.ipAllowlist) || safeguards.ipAllowlist.length === 0) {
    addIssue(blockers, integration, "missing_ip_allowlist", "Private-project API access has no IP allowlist.");
    actions.push("Add an institutional IP allowlist before enabling private project access.");
  }
  if (!safeguards.adminReviewPacket) {
    addIssue(warnings, integration, "missing_admin_review_packet", "Private-project access lacks an admin review packet.");
    actions.push("Generate an admin dashboard review packet for private project access.");
  }
}

function checkWebhookReadiness(integration, policy, blockers, warnings, actions) {
  const webhook = integration.webhook || {};
  if (!webhook.enabled) return;

  if (!policy.acceptedSigningAlgorithms.includes(webhook.signingAlgorithm)) {
    addIssue(blockers, integration, "weak_webhook_signing", "Webhook signing algorithm is missing or unsupported.");
    actions.push("Use HMAC-SHA256 or HMAC-SHA512 for webhook event signing.");
  }
  if (!webhook.secretRotatedAt) {
    addIssue(warnings, integration, "missing_webhook_secret_rotation", "Webhook secret rotation date is not recorded.");
    actions.push("Record webhook secret rotation evidence before production activation.");
  } else if (dayDiff(parseDate(webhook.secretRotatedAt), parseDate(policy.now)) > policy.maxWebhookSecretAgeDays) {
    addIssue(warnings, integration, "stale_webhook_secret", "Webhook signing secret is past the rotation window.");
    actions.push("Rotate the webhook signing secret before production activation.");
  }
  if (!webhook.deadLetterQueue) {
    addIssue(warnings, integration, "missing_dead_letter_queue", "Webhook delivery has no dead-letter queue.");
    actions.push("Configure a dead-letter queue for failed webhook deliveries.");
  }
  if (!webhook.retryPolicy || Number(webhook.retryPolicy.maxAttempts) > policy.maxWebhookRetryAttempts) {
    addIssue(warnings, integration, "unsafe_webhook_retry_policy", "Webhook retry policy can create retry storms.");
    actions.push(`Cap webhook retries at ${policy.maxWebhookRetryAttempts} attempts with jitter.`);
  }
}

function checkEvidence(integration, policy, evidence, warnings, actions) {
  if (!evidence.loadTestAt) {
    addIssue(warnings, integration, "missing_load_test", "No recent sandbox load-test evidence is attached.");
    actions.push("Attach sandbox load-test evidence for the contracted limits.");
  } else if (dayDiff(parseDate(evidence.loadTestAt), parseDate(policy.now)) > policy.staleLoadTestDays) {
    addIssue(warnings, integration, "stale_load_test", "Sandbox load-test evidence is stale.");
    actions.push("Refresh sandbox load-test evidence before production activation.");
  }
  if (!evidence.dashboardTag) {
    addIssue(warnings, integration, "missing_dashboard_tag", "Admin dashboard tag or cost center is missing.");
    actions.push("Add an admin dashboard tag or cost center for usage attribution.");
  }
}

function buildMetrics(results) {
  return {
    totalIntegrations: results.length,
    release: results.filter((item) => item.status === "release").length,
    review: results.filter((item) => item.status === "review").length,
    hold: results.filter((item) => item.status === "hold").length,
    blockers: results.reduce((sum, item) => sum + item.blockers.length, 0),
    warnings: results.reduce((sum, item) => sum + item.warnings.length, 0),
  };
}

function addIssue(list, integration, code, message) {
  list.push({ integrationId: integration.id, name: integration.name, code, message });
}

function numberOrNull(value) {
  return value == null ? null : Number(value);
}

function parseDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
}

function dayDiff(start, end) {
  const millis = end.getTime() - start.getTime();
  return Math.floor(millis / 86400000);
}

function stableDigest(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

module.exports = {
  DEFAULT_POLICY,
  evaluateIntegration,
  evaluatePortfolio,
  stableDigest,
};
