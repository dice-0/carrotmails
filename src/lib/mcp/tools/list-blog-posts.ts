import { defineTool } from "@lovable.dev/mcp-js";

const POSTS = [
  {
    slug: "gmail-bulk-sender-rules-2024",
    title: "Gmail bulk sender rules 2024",
    url: "https://carrotmails.work/blog/gmail-bulk-sender-rules-2024",
  },
  {
    slug: "how-to-capture-email-consent",
    title: "How to capture email consent",
    url: "https://carrotmails.work/blog/how-to-capture-email-consent",
  },
  {
    slug: "why-cold-email-is-dying",
    title: "Why cold email is dying",
    url: "https://carrotmails.work/blog/why-cold-email-is-dying",
  },
];

export default defineTool({
  name: "list_blog_posts",
  title: "List Carrot Mails blog posts",
  description: "Returns the list of published Carrot Mails blog posts with titles and public URLs.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(POSTS, null, 2) }],
    structuredContent: { posts: POSTS },
  }),
});
