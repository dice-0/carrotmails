
## Goal

Turn Carrot Mails into a fully paid product with zero free sending. Landing goes straight into the app in a "playground" state, and account + payment are handled silently later. Fix the broken payment unlock so a completed purchase immediately reflects in the UI.

## 1. Open, anonymous-first entry

- Route `/` becomes the app itself (compose + campaigns + templates + lists + forms + mailboxes visible), not the marketing/auth page.
- No redirect to `/auth` on first load. The `_authenticated` gate stays for anything that reads user-owned data, but the compose UI works fully offline against local state (draft body, subject, recipients, template preview).
- Everything the user types in the anonymous state is persisted to `localStorage` so it survives the silent signup.
- `/auth` is kept but only reached through explicit "sign in on another device" from the Profile tab.

## 2. Silent account creation

- Trigger: user finishes Profile (email + name) AND clicks a paid plan on Billing.
- Flow: create Supabase user with the profile email + a generated password, immediately sign them in, migrate the local draft/campaign/list/template state into their account, then hand off to the Dodo checkout with the new user id in metadata.
- Email + magic-link recovery is the "login from another device" path from the Profile tab.

## 3. New Profile tab

- New route `/app/profile` (also reachable pre-signup at `/profile` in the anonymous shell).
- Fields: account email (required, unique), display name, optional company.
- Completion state is what unlocks the Billing checkout button and mailbox connect.
- Profile email is the identity used for account, subscription ownership, recovery, and mailbox linking.

## 4. Remove the free tier

- Delete the 20-mail demo path in bulk-send + campaigns + UI copy.
- No sends are possible without an active paid entitlement. Backend `bulk-send` server fn hard-rejects when the caller has no active entitlement, regardless of quota.

## 5. Send-blocked modal

- Any Send / Schedule / Test Send button first checks: profile complete AND active paid entitlement AND at least one connected mailbox.
- If any is missing, open a centered playful modal (shadcn Dialog) with a witty message and two CTAs: "Complete profile" and "Choose a plan". Copy: "Whoa, cowboy. Your carrot isn't ripe yet, finish your profile and grab a plan before you launch this into the world."
- Same modal (different copy) fires from "Connect Mailbox" when no active plan exists, sending the user to Billing first.

## 6. Fix payment unlock (top priority)

Root cause investigation, then fix:

- Verify `dodo-webhook` route handler: signature check, event mapping (`subscription.active`, `payment.succeeded`, `subscription.renewed`), and that it writes to `billing_entitlements` + `billing_subscriptions` with the right `user_id` from checkout metadata.
- Confirm the checkout session includes `metadata.user_id` and `metadata.plan`; if missing, webhook cannot attribute the payment.
- After webhook success, the client must learn about it. Add:
  - a Supabase Realtime subscription on `billing_entitlements` for the current user in the app shell, and
  - a fallback poll of a `getMyEntitlement` server fn immediately after returning from checkout (`/app/billing?checkout=success`).
- On update: invalidate billing queries, flip the plan badge, unlock Send, show a success toast + confirmation card.
- Backfill: add a "Restore purchase" button on Billing that calls a `reconcileMyPurchases` server fn which asks Dodo for this customer's active subscriptions and upserts entitlements. This unblocks the user who already paid.

## 7. Plan rename + quota UI

- Rename "Pro" → "Growth" everywhere (UI copy, product config, billing helpers). Keep "Lifetime" name.
- Persistent plan badge in the sidebar footer: `Growth · 4,213 / 5,000 sends left` or `Lifetime · Unlimited`.
- Quota bar visible on Billing and on the Compose screen header.
- Growth quota = 5000 emails / billing period, decremented by `bulk-send` per successful recipient. Lifetime bypasses the counter and shows "Unlimited".
- Values update instantly via Realtime + query invalidation after each send batch and after the payment webhook fires.

## Technical section

- Routes
  - `src/routes/index.tsx`: replace landing with a lightweight redirect into the anonymous app shell.
  - New `src/routes/_public_app/` layout mirroring the sidebar but not gated; children reuse the compose/campaigns/templates/lists/forms components in "local mode".
  - `src/routes/_authenticated/app.profile.tsx` (and public twin) for the Profile tab.
- State
  - `src/lib/local-workspace.ts`: typed `localStorage` shim for anonymous drafts, lists, templates.
  - On sign-in, `migrateLocalWorkspace()` server fn ingests the JSON blob into the user's tables.
- Billing
  - `src/lib/billing.functions.ts`: add `getMyEntitlement`, `reconcileMyPurchases`, `consumeQuota`.
  - `src/routes/api/public/dodo-webhook.ts`: verify signature, upsert into `billing_entitlements` keyed on `user_id`, set `plan='growth'|'lifetime'`, `quota_remaining=5000` for growth, `unlimited=true` for lifetime.
  - Migration: ensure `billing_entitlements` has `plan text`, `quota_remaining int`, `unlimited bool`, `period_end timestamptz`, unique on `user_id`; add realtime publication.
  - Realtime hook `useMyEntitlement()` subscribes and feeds the sidebar badge + Send gate.
- Send gate
  - `src/lib/send-gate.ts`: `canSend({ profile, entitlement, mailboxes })` returns `{ ok, reason }`.
  - `<SendBlockedDialog />` shared component wired into every Send/Connect Mailbox button.
- Cleanup
  - Remove free-tier branches from `bulk-send.functions.ts`, `campaigns.functions.ts`, and any "20 free" copy in UI.
  - Replace all "Pro" strings with "Growth".

## Out of scope for this pass

- Team seats, per-mailbox quotas, annual vs monthly pricing changes, marketing site redesign.
