# Requirement Map

Issue #20 describes revenue infrastructure across subscription billing, usage-aligned growth, institutional plans, and billing engine controls. This module implements a narrow pre-invoice control for subscription renewals so unsafe renewal revenue is held before it becomes a bad charge or bad invoice.

| Issue area | Module coverage |
| --- | --- |
| Monthly and annual subscription cycles | Computes required notice windows by billing cadence before release. |
| Lab and institutional accounts | Evaluates lab renewals and adds institutional PO and procurement-contact checks. |
| Auto-scaling and volume changes | Flags undisclosed seat or usage changes above policy tolerance. |
| Free trials and trial conversion | Blocks trial-to-paid conversion when paid-start terms are not disclosed. |
| Secure payment readiness | Requires current auto-renewal consent evidence and cancellation-link coverage before charging. |
| Institutional invoicing | Blocks institutional renewals without approved purchase-order evidence. |
| Predictable recurring revenue | Emits deterministic hold/release decisions and audit digests for finance review. |
| Reviewer evidence | Generates JSON, Markdown, SVG, and MP4 artifacts from synthetic data only. |
