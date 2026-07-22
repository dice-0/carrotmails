import { defineTool } from "@lovable.dev/mcp-js";

const PLANS = [
  {
    id: "growth",
    name: "Growth",
    type: "subscription",
    quota_per_month: 5000,
    description: "Monthly plan with 5,000 sends per period, consent-based sending, one-click unsubscribe.",
  },
  {
    id: "lifetime",
    name: "Lifetime",
    type: "one_time",
    quota_per_month: null,
    description: "One-time purchase with unlimited sends.",
  },
];

export default defineTool({
  name: "list_plans",
  title: "List Carrot Mails plans",
  description: "Returns the publicly available Carrot Mails pricing plans and their sending quotas.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(PLANS, null, 2) }],
    structuredContent: { plans: PLANS },
  }),
});
