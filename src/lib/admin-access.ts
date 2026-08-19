/**
 * HQ (full access) allowlist.
 *
 * These accounts get unlimited sending, no plan requirement, and no
 * consent / unsubscribe compliance layer applied to their messages.
 * A connected Gmail mailbox is still required to send.
 */
export const ADMIN_EMAILS = [
  "work.josephraj@gmail.com",
  "admin@carrotmails.work",
] as const;

export const ADMIN_HQ_PATH = "/admin-061106-hq-fullaccess";

/**
 * Secret handshake key. Anyone who reaches the hidden HQ link and presents this
 * key gets HQ full access granted to their account (persisted as an entitlement),
 * no email allowlist required.
 */
export const HQ_ACCESS_KEY = "061106-hq-fullaccess";

/** Entitlement name stored in billing_entitlements for HQ full access. */
export const HQ_ENTITLEMENT = "hq";


export function isAdminEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((a) => a === normalized);
}
