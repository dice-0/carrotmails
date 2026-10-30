Keep temporary free-access behavior controlled by `src/lib/access-mode.ts` so billing, mailbox access, and sending stay consistent.
## Automation module
The Automation feature (draft-based outreach) lives in `src/lib/automation/*` and uses ONLY the `automation_*` / `mailbox_sync_state` tables; it must never write to the legacy `campaigns` / `campaign_recipients` / `bulk-send` flow. Initial campaigns are Gmail drafts only (never auto-sent), and follow-up sends always require an explicit user confirmation parameter.
