/**
 * Offline-first tool feedback (name + comment).
 * Persists in localStorage; optional mailto / JSON export for Beau.
 */

export const FEEDBACK_STORAGE_KEY = "rinnai-parts-feedback-v1";
export const FEEDBACK_EMAIL = "beau.dougall@mtcgas.com.au";
export const FEEDBACK_SUBJECT = "Rinnai Parts tool feedback";

/**
 * @typedef {{ id: string, name: string, comment: string, createdAt: string }} FeedbackEntry
 */

/**
 * @returns {FeedbackEntry[]}
 */
export function loadFeedback() {
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row) =>
        row &&
        typeof row === "object" &&
        typeof row.name === "string" &&
        typeof row.comment === "string"
    );
  } catch {
    return [];
  }
}

/**
 * @param {FeedbackEntry[]} entries
 */
function saveFeedback(entries) {
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(entries));
}

/**
 * @param {{ name: string, comment: string }} input
 * @returns {FeedbackEntry}
 */
export function appendFeedback(input) {
  const name = String(input?.name || "").trim();
  const comment = String(input?.comment || "").trim();
  if (!name) throw new Error("Name is required");
  if (!comment) throw new Error("Comment is required");

  const entry = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    comment,
    createdAt: new Date().toISOString(),
  };
  const next = [...loadFeedback(), entry];
  saveFeedback(next);
  return entry;
}

/**
 * @param {FeedbackEntry} entry
 */
export function formatFeedbackMailtoBody(entry) {
  return [
    "How can we improve this tool for you?",
    "",
    `Name: ${entry.name}`,
    `Submitted: ${entry.createdAt}`,
    "",
    entry.comment,
  ].join("\n");
}

/**
 * @param {FeedbackEntry} entry
 */
export function buildFeedbackMailto(entry) {
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
    FEEDBACK_SUBJECT
  )}&body=${encodeURIComponent(formatFeedbackMailtoBody(entry))}`;
}

/**
 * Download all stored feedback as JSON (durable offline export).
 */
export function downloadFeedbackJson() {
  const entries = loadFeedback();
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rinnai-parts-feedback-${new Date().toISOString().slice(0, 10)}.json`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return entries.length;
}
