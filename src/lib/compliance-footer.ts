// Compliance helpers: unsubscribe URL + Gmail-friendly List-Unsubscribe headers.

export function publicSiteOrigin() {
  return process.env.PUBLIC_SITE_URL || "https://carrotmails.work";
}

export function unsubscribeUrl(token: string) {
  return `${publicSiteOrigin()}/u/${token}`;
}

/**
 * Renders the required footer with sender identity and one-click unsubscribe.
 * Per Gmail sender guidelines (bulk senders) messages must include a visible
 * unsubscribe link and clear sender identity.
 */
export function complianceFooterHtml(opts: {
  senderName?: string | null;
  senderEmail: string;
  unsubUrl: string;
}) {
  const who = opts.senderName ? `${escapeHtml(opts.senderName)} · ${escapeHtml(opts.senderEmail)}` : escapeHtml(opts.senderEmail);
  return `You are receiving this because you opted in to hear from ${who}. <a href="${opts.unsubUrl}" style="color:#888;text-decoration:underline">Unsubscribe</a> at any time.`;
}

export function complianceFooterText(opts: { senderName?: string | null; senderEmail: string; unsubUrl: string }) {
  const who = opts.senderName ? `${opts.senderName} <${opts.senderEmail}>` : opts.senderEmail;
  return `\n\n---\nYou are receiving this because you opted in to hear from ${who}.\nUnsubscribe: ${opts.unsubUrl}`;
}

/**
 * Returns the extra RFC 8058 / RFC 2369 headers Gmail expects for bulk senders.
 * `List-Unsubscribe-Post` enables one-click unsubscribe.
 */
export function listUnsubscribeHeaders(unsubUrl: string): string[] {
  return [
    `List-Unsubscribe: <${unsubUrl}>`,
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
  ];
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
