import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "about",
  title: "About Carrot Mails",
  description: "Returns a short description of Carrot Mails, a consent-based email outreach and CRM platform.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: "Carrot Mails is a consent-based email outreach and CRM platform for sending permission-based commercial email from your own Gmail account. It enforces recipient consent, RFC 8058 one-click unsubscribe, and compliance footers. Learn more at https://carrotmails.work",
      },
    ],
  }),
});
