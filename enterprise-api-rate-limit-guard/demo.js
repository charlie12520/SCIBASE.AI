const fs = require("node:fs");
const path = require("node:path");
const { evaluatePortfolio } = require("./index");
const { sampleIntegrations } = require("./sample-data");

const reportDir = path.join(__dirname, "reports");
fs.mkdirSync(reportDir, { recursive: true });

const portfolio = evaluatePortfolio(sampleIntegrations);
const jsonPath = path.join(reportDir, "activation-packet.json");
const markdownPath = path.join(reportDir, "activation-report.md");
const svgPath = path.join(reportDir, "summary.svg");

fs.writeFileSync(jsonPath, `${JSON.stringify(portfolio, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(portfolio));
fs.writeFileSync(svgPath, renderSvg(portfolio));

console.log(`status=${portfolio.status}`);
console.log(`blockers=${portfolio.metrics.blockers}`);
console.log(`warnings=${portfolio.metrics.warnings}`);
console.log(`auditDigest=${portfolio.auditDigest}`);
console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
console.log(`wrote ${path.relative(process.cwd(), markdownPath)}`);
console.log(`wrote ${path.relative(process.cwd(), svgPath)}`);

function renderMarkdown(portfolio) {
  const rows = portfolio.integrations
    .map(
      (item) =>
        `| ${item.id} | ${item.status} | ${item.blockers.length} | ${item.warnings.length} | ${item.contractedSustainedRpm} | ${item.provisionedSustainedRpm} |`,
    )
    .join("\n");
  const actions = portfolio.integrations
    .flatMap((item) => item.actions.map((action) => `- ${item.id}: ${action}`))
    .join("\n");

  return `# Enterprise API Rate-Limit Contract Guard Report

Status: ${portfolio.status}

Audit digest: \`${portfolio.auditDigest}\`

## Summary

- Integrations checked: ${portfolio.metrics.totalIntegrations}
- Ready to release: ${portfolio.metrics.release}
- Needs review: ${portfolio.metrics.review}
- Held: ${portfolio.metrics.hold}
- Blockers: ${portfolio.metrics.blockers}
- Warnings: ${portfolio.metrics.warnings}

## Activation Decisions

| Integration | Status | Blockers | Warnings | Contract RPM | Provisioned RPM |
| --- | --- | ---: | ---: | ---: | ---: |
${rows}

## Remediation Actions

${actions}
`;
}

function renderSvg(portfolio) {
  const cards = portfolio.integrations
    .map((item, index) => {
      const y = 150 + index * 96;
      const color = item.status === "release" ? "#0f766e" : item.status === "review" ? "#b45309" : "#b91c1c";
      return `<g>
  <rect x="60" y="${y}" width="1040" height="72" rx="8" fill="#ffffff" stroke="#d1d5db"/>
  <text x="90" y="${y + 28}" font-size="22" font-weight="700" fill="#111827">${escapeXml(item.name)}</text>
  <text x="90" y="${y + 54}" font-size="16" fill="#4b5563">${escapeXml(item.institution)} - ${escapeXml(item.integrationType)}</text>
  <rect x="780" y="${y + 18}" width="140" height="36" rx="6" fill="${color}"/>
  <text x="850" y="${y + 42}" text-anchor="middle" font-size="16" font-weight="700" fill="#ffffff">${item.status.toUpperCase()}</text>
  <text x="950" y="${y + 32}" font-size="15" fill="#374151">B ${item.blockers.length} / W ${item.warnings.length}</text>
</g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1160" height="600" viewBox="0 0 1160 600">
<rect width="1160" height="600" fill="#f8fafc"/>
<text x="60" y="62" font-size="34" font-weight="800" fill="#111827">Enterprise API Rate-Limit Contract Guard</text>
<text x="60" y="98" font-size="18" fill="#4b5563">Pre-production activation checks for API limits, scopes, retries, webhooks, and admin evidence.</text>
<g>
  <rect x="60" y="118" width="240" height="44" rx="8" fill="#111827"/>
  <text x="180" y="147" text-anchor="middle" font-size="17" font-weight="700" fill="#ffffff">${portfolio.status}</text>
  <text x="330" y="147" font-size="17" fill="#374151">${portfolio.metrics.blockers} blockers, ${portfolio.metrics.warnings} warnings across ${portfolio.metrics.totalIntegrations} integrations</text>
</g>
${cards}
<text x="60" y="560" font-size="13" fill="#6b7280">Synthetic demo data only. Audit digest ${portfolio.auditDigest.slice(0, 24)}...</text>
</svg>
`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
