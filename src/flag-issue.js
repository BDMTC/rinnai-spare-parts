/**
 * Flag a part problem → mailto stores@mtcgas.com.au for Beau review.
 */

import { STORES_EMAIL } from "./cart.js";

export const FLAG_ISSUE_SUBJECT = "Parts issue flagged on Rinnai parts list";

/**
 * @param {{ title?: string, name?: string, code?: string }} part
 */
export function formatFlagIssueBody(part) {
  const title = String(part?.title || part?.name || part?.code || "unknown part").trim();
  const code = String(part?.code || "").trim();
  const lines = [
    `Hi - an issue has been flagged with part "${title}" would you please send to beau to review.`,
  ];
  if (code) {
    lines.push("");
    lines.push(`Part code: ${code}`);
  }
  return lines.join("\n");
}

/**
 * @param {{ title?: string, name?: string, code?: string }} part
 */
export function buildFlagIssueMailto(part) {
  const body = formatFlagIssueBody(part);
  return `mailto:${STORES_EMAIL}?subject=${encodeURIComponent(
    FLAG_ISSUE_SUBJECT
  )}&body=${encodeURIComponent(body)}`;
}
