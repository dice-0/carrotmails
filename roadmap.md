# Roadmap

## Current task: Advanced Email Automation Module (uploaded spec)
Status: implemented and typechecked; browser smoke test passed (workspace opens, campaign created, compose tab renders).

Reference: INITIAL_EMAIL_DRAFT_CC_VERIFIED_BUNDLE.zip (Apps Script; behavior reference only).

## Done
- [x] Tables: automation_campaigns, automation_contacts, automation_steps,
      automation_drafts, automation_messages, automation_events,
      automation_suppressions, automation_audits, mailbox_sync_state.
      Additive; existing campaigns/bulk-send untouched.
- [x] Gmail scopes: gmail.compose + gmail.readonly added to new-connection OAuth
      (mailboxes.functions.ts); existing connections already carry the needed scopes.
- [x] Server functions: campaign/step/contact CRUD, CSV import with custom columns
      and per-row duplicate counting, merge-field engine (dynamic headers, fallbacks,
      HTML-safe substitution), Gmail draft creation with CC read-back verification,
      duplicate draft prevention, test draft to own mailbox, conservative
      manual-send reconciliation.
- [x] Follow-up engine: FU1-FU4 with editable delays, same-thread reply drafts
      (In-Reply-To/References), draft mode + explicit confirm-gated batch send,
      manual-send reconciliation, reply/bounce/OOO detection, suppression gating,
      activity log, audit snapshots.
- [x] UI: /app/automation workspace (campaigns / activity / suppression), composer
      reusing RichEditor, per-recipient CC/BCC editor, follow-up preview + send.
- [x] Unit tests: tests/automation-merge.test.ts (merge tags, fallbacks, escaping,
      custom columns, CC parsing/validation) all passing.
- [x] Typecheck: build OK (no type errors).

## Untested / known limits (report to user)
- No real Gmail draft API call was made end to end (needs a live connected mailbox).
- Existing mailboxes connected before the scope change keep working because they
  already carry gmail.compose/readonly; any mailbox that lacks them gets a 403
  and must reconnect.
- Reconciliation draft-matching is conservative; edge cases (edited subjects)
  may not match.
- No real emails or deploys happened; nothing sends automatically.

## Standing notes
- Never report a draft as sent; never auto-send initial emails.
- Keep existing pricing/auth/mailbox flows untouched.
- Free access mode controlled by src/lib/access-mode.ts stays as is.
