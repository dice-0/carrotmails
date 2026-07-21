import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";

const TITLE = "Blog | Carrot Mails";
const DESC = "Guides on permission-based email, Gmail deliverability, consent capture, and running compliant email programs from your own inbox.";
const URL = "https://carrotmails.work/blog";

const POSTS = [
  {
    slug: "/blog/gmail-bulk-sender-rules-2024",
    title: "Gmail's 2024 bulk sender rules, explained",
    excerpt: "SPF, DKIM, DMARC, one-click unsubscribe, and the 0.3% spam threshold. What every founder needs before hitting send.",
    date: "2025-01-15",
  },
  {
    slug: "/blog/how-to-capture-email-consent",
    title: "How to capture email consent that actually holds up",
    excerpt: "Double opt-in, checkbox wording, record-keeping, and the difference between GDPR consent and CAN-SPAM permission.",
    date: "2025-02-05",
  },
  {
    slug: "/blog/why-cold-email-is-dying",
    title: "Why cold email is dying, and what replaces it",
    excerpt: "Deliverability, reputation, and why permission-based sending is the only strategy that survives the next inbox update.",
    date: "2025-03-01",
  },
];

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Carrot Mails Blog",
          url: URL,
          publisher: { "@type": "Organization", name: "Carrot Mails" },
          blogPost: POSTS.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            description: p.excerpt,
            datePublished: p.date,
            url: `https://carrotmails.work${p.slug}`,
          })),
        }),
      },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <MarketingPage
      eyebrow="Blog"
      title="Permission-based email, done right"
      intro="Guides on Gmail deliverability, consent capture, and running email programs that recipients actually want."
    >
      <div className="not-prose mt-8 space-y-4">
        {POSTS.map((p) => (
          <Link
            key={p.slug}
            to={p.slug as "/blog/gmail-bulk-sender-rules-2024"}
            className="block rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/40"
          >
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {new Date(p.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </div>
            <h2 className="mt-2 text-xl font-semibold text-foreground">{p.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{p.excerpt}</p>
          </Link>
        ))}
      </div>
    </MarketingPage>
  );
}
