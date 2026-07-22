import { defineMcp } from "@lovable.dev/mcp-js";
import aboutTool from "./tools/about";
import listPlansTool from "./tools/list-plans";
import listBlogPostsTool from "./tools/list-blog-posts";

export default defineMcp({
  name: "carrot-mails-mcp",
  title: "Carrot Mails",
  version: "0.1.0",
  instructions:
    "Public tools for Carrot Mails, a consent-based email outreach and CRM platform. Use `about` for a product summary, `list_plans` for pricing, and `list_blog_posts` for published articles. No authentication is required and no per-user data is exposed.",
  tools: [aboutTool, listPlansTool, listBlogPostsTool],
});
