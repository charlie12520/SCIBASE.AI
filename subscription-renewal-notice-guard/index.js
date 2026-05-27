const crypto = require("node:crypto");

const DEFAULT_POLICY = Object.freeze({
  now: "2026-05-27T12:00:00.000Z",
  minimumNoticeDays: {
    monthly: 7,
    annual: 30,
    priceIncrease: 30,
    institutional: 45,
    trialToPaid: 3,
  },
  maxSeatDeltaWithoutDisclosure: 0,
  autoRenewConsentMaxAgeDays: 730,
});

function evaluatePortfolio(renewals, policy = DEFAULT_POLICY) {
  const evaluated = renewals.map((renewal) => evaluateRenewal(renewal, policy));
  const blockers = evaluated.flatMap((item) => item.blockers);
  const warnings = evaluated.flatMap((item) => item.warnings);
  const metrics = buildMetrics(evaluated);
  const status = blockers.length > 0 ? "hold_renewals" : warnings.length > 0 ? "review" : "ready";
  const payload = {
    generatedAt: policy.now,
    status,
    metrics,
    renewals: evaluated,
  };

  return {
    ...payload,
    auditDigest: stableDigest(payload),
  };
}

function evaluateRenewal(renewal, policy = DEFAULT_POLICY) {
  const blockers = [];
  const warnings = [];
  const actions = [];
  const notice = renewal.notice || {};
  const renewalDate = parseDate(renewal.renewalDate);
  const noticeDate = notice.sentAt ? parseDate(notice.sentAt) : null;
  const daysOfNotice = noticeDate ? dayDiff(noticeDate, renewalDate) : null;
  const requiredNoticeDays = requiredNoticeWindow(renewal, policy);

  // Notice timing is evaluated before invoice or auto-renewal release so finance
  // can fix customer-facing disclosures before creating a bad charge.
  if (!noticeDate) {
    addIssue(blockers, renewal, "missing_notice", "No customer renewal notice is recorded.");
    actions.push("Send a renewal notice before invoice generation or auto-renewal.");
  } else if (daysOfNotice < requiredNoticeDays) {
    addIssue(
      blockers,
      renewal,
      "short_notice_window",
      `Notice window is ${daysOfNotice} days; required minimum is ${requiredNoticeDays} days.`,
    );
    actions.push("Hold renewal until the minimum notice window is satisfied or finance approves an exception.");
  }

  if (renewal.autoRenewal) {
    checkAutoRenewalConsent(renewal, policy, blockers, warnings, actions);
    if (!notice.cancellationUrl) {
      addIssue(blockers, renewal, "missing_cancellation_link", "Auto-renewal notice has no cancellation link.");
      actions.push("Add a self-serve cancellation or opt-out URL to the customer notice.");
    }
  }

  if (hasPriceChange(renewal)) {
    if (!notice.priceChangeSummary) {
      addIssue(blockers, renewal, "missing_price_change_summary", "Price change is not disclosed in the notice.");
      actions.push("Disclose old price, new price, delta, and effective date.");
    }
    if (daysOfNotice !== null && daysOfNotice < policy.minimumNoticeDays.priceIncrease) {
      addIssue(
        blockers,
        renewal,
        "late_price_change_notice",
        `Price change notice is ${daysOfNotice} days; required minimum is ${policy.minimumNoticeDays.priceIncrease} days.`,
      );
      actions.push("Delay the changed price or send a corrected notice with a compliant effective date.");
    }
  }

  const changedSeats = Math.abs(seatDelta(renewal));
  if (changedSeats > policy.maxSeatDeltaWithoutDisclosure && !notice.seatOrUsageSummary) {
    addIssue(
      warnings,
      renewal,
      "missing_seat_usage_summary",
      "Seat or usage delta is not summarized for the customer.",
    );
    actions.push("Add seat and usage deltas to the notice before renewal approval.");
  }

  if (renewal.trialToPaid) {
    if (!notice.trialConversionSummary) {
      addIssue(blockers, renewal, "missing_trial_conversion_notice", "Trial-to-paid conversion terms are not disclosed.");
      actions.push("Send a trial conversion notice with paid start date, price, and cancellation instructions.");
    }
  }

  if (renewal.customerType === "institution") {
    if (!renewal.purchaseOrder || renewal.purchaseOrder.status !== "approved") {
      addIssue(blockers, renewal, "missing_po_approval", "Institutional renewal lacks approved purchase-order evidence.");
      actions.push("Collect or attach PO renewal approval before invoicing.");
    }
    if (!notice.procurementContact) {
      addIssue(warnings, renewal, "missing_procurement_contact", "Notice does not name the institutional procurement contact.");
      actions.push("Add procurement owner and renewal approval path to the notice packet.");
    }
  }

  if (!notice.supportContact) {
    addIssue(warnings, renewal, "missing_support_contact", "Renewal notice has no support contact.");
    actions.push("Add a billing support contact for renewal questions.");
  }

  const status = blockers.length > 0 ? "hold" : warnings.length > 0 ? "review" : "release";
  return {
    id: renewal.id,
    account: renewal.accountName,
    customerType: renewal.customerType,
    renewalDate: renewal.renewalDate,
    status,
    daysOfNotice,
    requiredNoticeDays,
    blockers,
    warnings,
    actions: [...new Set(actions)],
    auditDigest: stableDigest({ renewal, status, blockers, warnings }),
  };
}

function checkAutoRenewalConsent(renewal, policy, blockers, warnings, actions) {
  const consent = renewal.autoRenewalConsent || {};
  if (!consent.acceptedAt || !consent.termsVersion) {
    addIssue(blockers, renewal, "missing_auto_renewal_consent", "Auto-renewal consent evidence is incomplete.");
    actions.push("Capture dated auto-renewal consent and terms version before charging.");
    return;
  }

  const consentAge = dayDiff(parseDate(consent.acceptedAt), parseDate(policy.now));
  if (consentAge > policy.autoRenewConsentMaxAgeDays) {
    addIssue(warnings, renewal, "stale_auto_renewal_consent", `Consent is ${consentAge} days old.`);
    actions.push("Refresh auto-renewal consent on the current terms version.");
  }

  if (consent.termsVersion !== renewal.currentTermsVersion) {
    addIssue(blockers, renewal, "terms_version_mismatch", "Consent terms version does not match current renewal terms.");
    actions.push("Request consent on the current renewal terms before auto-renewal.");
  }
}

function requiredNoticeWindow(renewal, policy) {
  const base = renewal.billingCadence === "annual" ? policy.minimumNoticeDays.annual : policy.minimumNoticeDays.monthly;
  const windows = [base];
  if (renewal.customerType === "institution") windows.push(policy.minimumNoticeDays.institutional);
  if (renewal.trialToPaid) windows.push(policy.minimumNoticeDays.trialToPaid);
  if (hasPriceChange(renewal)) windows.push(policy.minimumNoticeDays.priceIncrease);
  return Math.max(...windows);
}

function buildMetrics(results) {
  return {
    totalRenewals: results.length,
    release: results.filter((item) => item.status === "release").length,
    review: results.filter((item) => item.status === "review").length,
    hold: results.filter((item) => item.status === "hold").length,
    blockers: results.reduce((sum, item) => sum + item.blockers.length, 0),
    warnings: results.reduce((sum, item) => sum + item.warnings.length, 0),
  };
}

function hasPriceChange(renewal) {
  return Number(renewal.currentPriceCents) !== Number(renewal.nextPriceCents);
}

function seatDelta(renewal) {
  return Number(renewal.nextSeats || 0) - Number(renewal.currentSeats || 0);
}

function addIssue(list, renewal, code, message) {
  list.push({ renewalId: renewal.id, account: renewal.accountName, code, message });
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
  evaluatePortfolio,
  evaluateRenewal,
  stableDigest,
};
