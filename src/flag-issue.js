/**
 * Flag a part problem → mailto beau.dougall@mtcgas.com.au for review.
 */

export const FLAG_ISSUE_EMAIL = "beau.dougall@mtcgas.com.au";
export const FLAG_ISSUE_SUBJECT = "Parts issue flagged on Rinnai parts list";

/**
 * @param {{
 *   title?: string,
 *   name?: string,
 *   code?: string,
 *   description?: string,
 *   pins?: string|null,
 * }} part
 */
export function formatFlagIssueBody(part) {
  const title = String(
    part?.title || part?.name || part?.description || part?.code || "unknown part"
  ).trim();
  const code = String(part?.code || "").trim();
  const description = String(
    part?.description || part?.title || part?.name || ""
  ).trim();
  const pins = String(part?.pins || "").trim();

  const lines = [
    `Hi - an issue has been flagged with part "${title}".`,
    "",
    "What's the problem? Please describe the issue or reason for flagging below:",
    "",
    "",
  ];
  if (code) {
    lines.push(`Part code: ${code}`);
  }
  if (description && description !== code) {
    lines.push(`Description: ${description}`);
  }
  if (pins) {
    lines.push(`Pins: ${pins}`);
  }
  return lines.join("\n");
}

/**
 * @param {{
 *   title?: string,
 *   name?: string,
 *   code?: string,
 *   description?: string,
 *   pins?: string|null,
 * }} part
 */
export function buildFlagIssueMailto(part) {
  const code = String(part?.code || "").trim();
  const subject = code
    ? `${FLAG_ISSUE_SUBJECT} — ${code}`
    : FLAG_ISSUE_SUBJECT;
  const body = formatFlagIssueBody(part);
  return `mailto:${FLAG_ISSUE_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
