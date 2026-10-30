# Roadmap

## Current task
Build the Advanced Email Automation Module (uploaded spec) into the existing Automation tab.
Reference implementation: INITIAL_EMAIL_DRAFT_CC_VERIFIED_BUNDLE.zip (Apps Script; behavior reference only, no Sheets/Apps Script dependency).

## Phase 1: Audit (in progress)
- [ ] Explore agent mapping: nav, campaigns, gmail-send, lists, RichEditor, DB schema.

## Phase 2: Architecture
- [ ] New tables: automation_campaigns, automation_contacts, automation_steps,
      automation_drafts, automation_messages, automation_events,
      automation_suppressions, automation_audits, mailbox_sync_state.
      Additive; do not touch existing campaigns/bulk-send tables.
- [ ] Gmail scopes: add gmail.compose (drafts) + gmail.readonly (reconciliation,
      reply/bounce detection) to mailbox OAuth connect; existing connections
      (work.josephraj, sharonjacobyt) already carry gmail.modify/readonly so no re-consent for them.

## Phase 3: Core automation
- [ ] Server functions: campaigns CRUD, recipients (CSV import + custom columns),
      merge-field engine (dynamic headers, fallbacks, HTML-safe substitution),
      Gmail draft creation (drafts.create, one draft per recipient, CC verify loop
      from bundle), duplicate draft prevention, test draft to own mailbox.
- [ ] UI: /app/automation workspace (Campaigns / Sequences / Activity / Suppression),
      campaign create wizard, composer reusing RichEditor, per-recipient CC/BCC table.

## Phase 4: Follow-up engine
- [ ] FU1-FU4 stages, editable delays, same-thread reply drafts (threadId,
      In-Reply-To, References), Mode A draft / Mode B explicit batch send,
      manual-send reconciliation, reply + bounce detection, suppression gating,
      activity log, audit snapshots.

## Phase 5: Testing + review
- [ ] Unit tests for merge engine, interval math, suppression gating, CC parsing.
- [ ] Report implemented vs untested; no live sends without approval.

## Standing notes
- Never report a draft as sent; never auto-send initial emails.
- Keep existing pricing/auth/mailbox flows untouched.
- Free access mode controlled by src/lib/access-mode.ts stays as is.
