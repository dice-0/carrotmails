import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, articleSchema, breadcrumbSchema } from "@/components/MarketingPage";

const TITLE = "Why Cold Email Is Dying, and What Replaces It | Carrot Mails";
const DESC = "Deliverability, reputation, and why permission-based sending is the only email strategy that survives the next inbox update.";
const SLUG = "/blog/why-cold-email-is-dying";
const URL = `https://carrotmails.work${SLUG}`;
const DATE = "2025-03-01";

export const Route = createFileRoute("/blog/why-cold-email-is-dying")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "article" },
      { property: "article:published_time", content: DATE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(articleSchema({ title: TITLE, description: DESC, slug: SLUG, datePublished: DATE })) },
      { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([
        { name: "Home", slug: "/" },
        { name: "Blog", slug: "/blog" },
        { name: "Why cold email is dying", slug: SLUG },
      ])) },
    ],
  }),
  component: Post,
});

function Post() {
  return (
    <MarketingPage
      eyebrow="Strategy · March 2025"
      title="Why cold email is dying, and what replaces it"
      intro="Cold email built a lot of B2B pipelines in the 2010s. The inbox has changed. Here's what stopped working, why, and what to do instead."
    >
      <h2>What killed cold email</h2>
      <p>Three things, all at once:</p>
      <ol>
        <li><strong>Gmail and Yahoo's 2024 sender rules</strong> raised the cost of a spam complaint from "annoying" to "your domain is dead."</li>
        <li><strong>AI-generated outreach</strong> flooded the inbox. Recipients now treat cold email the way they treat cold calls: reflexive delete.</li>
        <li><strong>DMARC enforcement</strong> and BIMI made it harder to spoof, harder to warm up new domains, and harder to hide from reputation systems.</li>
      </ol>

      <h2>The math has flipped</h2>
      <p>
        In 2018, sending 10,000 cold emails might get you 30 replies and 3 meetings. Today the same volume
        gets you 5 replies, 40 spam complaints, and a permanently damaged sending domain. The unit economics
        no longer work.
      </p>

      <h2>What replaces it</h2>
      <h3>Permission-based email to a smaller, warmer list</h3>
      <p>
        A list of 500 people who opted in outperforms a list of 50,000 who didn't. Open rates go from 5% to
        40%, complaints stay under 0.1%, and your sending domain builds a reputation instead of burning one.
      </p>
      <h3>Content that captures consent</h3>
      <p>
        Publish something useful, gate the good version behind an opt-in, and email people who asked. That
        loop compounds. Cold outreach doesn't.
      </p>
      <h3>Send from your own inbox</h3>
      <p>
        Recipients trust messages from a real person more than blasts from a marketing platform. Sending
        from your own Gmail also ties delivery to your own domain reputation, which you control.
      </p>

      <h2>What Carrot Mails does with this</h2>
      <p>
        We built Carrot Mails to make the new model easy: consent tracked per contact, one-click unsubscribe
        on every send, reply detection that pauses outreach automatically, and sending from your own Gmail
        so recipients see a normal message. No cold lists. No shared IPs.
      </p>
    </MarketingPage>
  );
}
