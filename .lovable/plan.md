# Consent-Based Paid Email Platform Refactor

Reframe Carrot Mails as a permission-based CRM email tool. Remove all cold-outreach framing, enforce consent everywhere, fix the payment-unlock bug, and make the product review-ready for Google Workspace API verification.

## 1. Product positioning & copy

- Rewrite landing / index (`src/routes/index.tsx`), auth page, sidebar taglines, empty states, feature tiles.
- Ban words: "cold email", "prospecting", "scrape", "outreach to strangers", "mass mailing", "unsolicited", "20 free sends".
- Use: "opt-in campaigns", "customer communication", "newsletters to your contacts", "CRM-friendly sending".
- Add a short compliance blurb ("You may only send to contacts who have consented") on landing, Compose, Lists, and Billing.
- Update `public/llms.txt`, README, and JSON-LD in `__root.tsx` accordingly.

## 2. Anonymous-first entry, silent account

- `/` no longer forces auth. Open directly into the app shell in explore mode (compose, view lists/templates/campaigns, no send).
- Anonymous local workspace persisted to `localStorage` (`src/lib/local-workspace.ts`).
- Silent account creation triggered only when the user (a) completes Profile and (b) clicks a paid plan or Connect Mailbox. Uses Supabase email+random password, then immediately signs them in and migrates local state.
- Keep `/auth` accessible for "sign in from another device" via Profile tab.

## 3. Profile tab

- New route `/app/profile` (already scaffolded — polish it): email, display name, subscription-owner email (defaults to account email), optional company.
- Completion of Profile is a hard prerequisite for payment and mailbox connect.

## 4. Rename Pro → Premium

- Replace "Pro" everywhere in UI, plan tiles, billing helpers, DB seed offers, JSON-LD, sidebar badges. Keep "Lifetime" untouched.
- Premium = 5,000 sends / period. Lifetime = unlimited.

## 5. Fix payment unlock (top priority)

- Audit `src/routes/api/public/dodo-webhook.ts`: signature check, event handling, upsert into `billing_entitlements` keyed on `user_id` from `metadata.user_id`.
- Ensure Dodo checkout session includes `metadata.user_id` and `metadata.plan`.
- Client: Realtime subscription on `billing_entitlements`/`billing_subscriptions` (already in `useBilling`) + immediate poll of `getBillingStatus` on return to `/app/billing?checkout=success`.
- "Restore purchase" button calls `reconcileMyPurchases` (already exists, keep fixed sort so `active` wins).
- On update: invalidate billing queries, flip plan badge, unlock Send, toast + confirmation card.

## 6. Send gate & modal

- Central `canSend({ profile, entitlement, mailbox, consent })` in `src/lib/send-gate.ts`.
- Reuse `SendBlockedDialog` with witty-but-professional copy. Reasons: `profile`, `plan`, `mailbox`, `consent`, `quota`.
- Wired to every Send / Schedule / Test-Send / Connect-Mailbox button in Compose, Campaigns, Mailboxes.

## 7. Consent enforcement

- DB migration: add `consent_confirmed boolean NOT NULL DEFAULT false`, `consent_source text`, `consent_confirmed_at timestamptz` on `contact_lists` and `campaigns`. Add `consent_confirmed_at timestamptz` on `contacts`.
- Lists UI: require a checkbox "I confirm every recipient in this list has opted in to receive commercial email from me" + free-text `consent_source` (e.g. "Signup form Feb 2025") before the list can be used.
- Campaign compose: cannot select a list unless the list is consent-confirmed. Show a consent banner on Campaign detail.
- Bulk-send server fn (`src/lib/bulk-send.functions.ts`) hard-rejects if list/campaign has no `consent_confirmed`.
- Recipient import: block CSVs unless the user re-confirms consent at import time. Store `consent_source` on the list.
- Manual add: single-recipient sends require a per-send consent confirmation.

## 8. Compliance email footer & unsubscribe

- Every outgoing email auto-appends an HTML+text footer with sender identity (from Profile: display name, business email) and a `List-Unsubscribe` header + one-click unsubscribe URL using existing `email_unsubscribe_tokens`.
- `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` per Gmail sender guidelines.
- Footer template stored in a shared helper `src/lib/compliance-footer.ts`.

## 9. Remove free tier

- Delete "20 free sends" logic and copy from `bulk-send.functions.ts`, `campaigns.functions.ts`, Compose, landing.
- Backend hard-rejects send when caller has no active paid entitlement, regardless of count.

## 10. Verification readiness

- Add a `REVIEWER.md` at repo root with test account credentials, walkthrough steps, and screenshots list.
- Seed a dedicated reviewer test account (documented) with Premium entitlement pre-provisioned.
- Ensure the OAuth consent flow only requests `openid email profile gmail.send` (already trimmed).
- Add an in-app "Compliance" info card on Billing summarizing consent rules and unsubscribe handling.

## Technical section

- **Routes/UI:** `src/routes/index.tsx` (explore-mode redirect), polish `_authenticated/app.profile.tsx`, Compose + Campaign forms gain consent step, Lists gain consent modal.
- **DB migration:** columns above + backfill existing rows to `consent_confirmed=false` and force re-confirmation. Realtime already on billing tables.
- **Server fns:** update `lists.functions.ts`, `campaigns.functions.ts`, `bulk-send.functions.ts`, `mailboxes.functions.ts` for consent+plan gates. Confirm `billing.functions.ts` webhook + reconcile logic.
- **Local workspace:** `src/lib/local-workspace.ts` + `migrateLocalWorkspace` server fn called on first sign-in.
- **Copy sweep:** grep-and-replace across `src/routes/**`, `src/components/**` for banned terms; regenerate `public/llms.txt`.
- **Send helper:** `src/lib/compliance-footer.ts` injects footer + `List-Unsubscribe` headers into `gmail-send.server.ts`.

## Out of scope

- New pricing tiers, team seats, non-Gmail providers, marketing site redesign, custom Google OAuth branding (already deferred).
