import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, articleSchema, breadcrumbSchema } from "@/components/MarketingPage";

const TITLE = "Gmail's 2024 Bulk Sender Rules, Explained | Carrot Mails";
const DESC = "SPF, DKIM, DMARC, one-click unsubscribe, and the 0.3% spam threshold. What every founder needs before hitting send.";
const SLUG = "/blog/gmail-bulk-sender-rules-2024";
const URL = `https://carrotmails.work${SLUG}`;
const DATE = "2025-01-15";

export const Route = createFileRoute("/blog/gmail-bulk-sender-rules-2024")({
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
      {
        type: "application/ld+json",
        children: JSON.stringify(articleSchema({ title: TITLE, description: DESC, slug: SLUG, datePublished: DATE })),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(breadcrumbSchema([
          { name: "Home", slug: "/" },
          { name: "Blog", slug: "/blog" },
          { name: "Gmail 2024 bulk sender rules", slug: SLUG },
        ])),
      },
    ],
  }),
  component: Post,
});

function Post() {
  return (
    <MarketingPage
      eyebrow="Deliverability · January 2025"
      title="Gmail's 2024 bulk sender rules, explained"
      intro="In February 2024, Gmail and Yahoo raised the bar for anyone sending more than 5,000 emails a day. Here's what changed, what it means for small senders, and what you actually have to do."
    >
      <h2>The three hard requirements</h2>
      <p>Google's Email Sender Guidelines now enforce three things for bulk senders:</p>
      <ol>
        <li><strong>Authenticate your mail</strong> with SPF, DKIM, and DMARC. All three, aligned to your sending domain.</li>
        <li><strong>Support one-click unsubscribe</strong> via RFC 8058 List-Unsubscribe and List-Unsubscribe-Post headers.</li>
        <li><strong>Stay under 0.3% spam complaints</strong>, measured in Google Postmaster Tools. Ideally under 0.1%.</li>
      </ol>

      <h2>SPF, DKIM, DMARC in plain English</h2>
      <p>
        <strong>SPF</strong> is a DNS record listing which servers are allowed to send mail from your domain.
        <strong> DKIM</strong> signs each outgoing message with a private key so recipients can verify it wasn't
        modified. <strong>DMARC</strong> tells receivers what to do when SPF or DKIM fails — usually "reject."
      </p>
      <p>
        If you send from your own Gmail account through Carrot Mails, Google handles SPF and DKIM for you.
        You still need a DMARC record on your domain: <code>v=DMARC1; p=none; rua=mailto:you@yourdomain.com</code>
        is the safe starting point.
      </p>

      <h2>The 5,000/day threshold</h2>
      <p>
        The rules technically apply to senders over 5,000 messages/day to Gmail addresses. In practice, Google
        treats every sender by these standards. Building a program that ignores them is building a program
        that will hit a wall in six months.
      </p>

      <h2>What breaks first</h2>
      <p>
        The 0.3% spam threshold is the one most people miss. That's three complaints per thousand sends. If
        your list has any stale, purchased, or scraped addresses, you'll cross it fast. Once you do, Gmail
        starts routing your mail to spam automatically, and reputation takes months to rebuild.
      </p>

      <h2>What to do this week</h2>
      <ul>
        <li>Add a DMARC record to your domain</li>
        <li>Verify SPF and DKIM in <a href="https://postmaster.google.com">Google Postmaster Tools</a></li>
        <li>Audit your list — remove anyone who hasn't opened in 6+ months</li>
        <li>Use a sender that adds RFC 8058 headers automatically (Carrot Mails does this by default)</li>
      </ul>
    </MarketingPage>
  );
}
