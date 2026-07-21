import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, articleSchema, breadcrumbSchema } from "@/components/MarketingPage";

const TITLE = "How to Capture Email Consent That Holds Up | Carrot Mails";
const DESC = "Double opt-in, checkbox wording, record-keeping, and the difference between GDPR consent and CAN-SPAM permission.";
const SLUG = "/blog/how-to-capture-email-consent";
const URL = `https://carrotmails.work${SLUG}`;
const DATE = "2025-02-05";

export const Route = createFileRoute("/blog/how-to-capture-email-consent")({
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
        { name: "How to capture email consent", slug: SLUG },
      ])) },
    ],
  }),
  component: Post,
});

function Post() {
  return (
    <MarketingPage
      eyebrow="Compliance · February 2025"
      title="How to capture email consent that actually holds up"
      intro="Consent is the foundation of every deliverability strategy that works. Here's how to capture it in a way that satisfies GDPR, CAN-SPAM, and your recipient's inbox filter."
    >
      <h2>Consent vs. permission vs. legitimate interest</h2>
      <p>
        <strong>Consent</strong> (GDPR): the recipient took a clear affirmative action to opt in. Pre-checked
        boxes don't count. <strong>Permission</strong> (CAN-SPAM): the recipient hasn't opted out and the
        message includes required disclosures. <strong>Legitimate interest</strong>: a narrow GDPR carve-out
        for existing customers, and easy to over-claim.
      </p>
      <p>For marketing email, aim for consent. It's the highest standard and the safest for deliverability.</p>

      <h2>What good consent looks like</h2>
      <ul>
        <li>Unchecked checkbox on a form, next to clear language</li>
        <li>Language that names your company and what you'll send</li>
        <li>A record: timestamp, IP address, the form URL, the exact wording shown</li>
        <li>Ideally a double opt-in confirmation email</li>
      </ul>

      <h3>Good checkbox wording</h3>
      <blockquote>
        Yes, send me product updates and occasional offers from Carrot Mails. I can unsubscribe anytime.
      </blockquote>

      <h3>Bad checkbox wording</h3>
      <blockquote>
        By continuing you agree to our marketing emails, partner offers, and terms of service.
      </blockquote>

      <h2>Double opt-in, and why it's worth the friction</h2>
      <p>
        A double opt-in email confirms the recipient owns the address and actively wants your mail. It cuts
        signup lists by 10-30%, and it cuts spam complaints by more. Recipients who confirm are 2-3x more
        engaged over the following year.
      </p>

      <h2>Record-keeping</h2>
      <p>
        Every contact in Carrot Mails carries a <code>consent_source</code> field, a <code>consent_at</code>
        timestamp, and the URL where consent was captured. That's what you'll need if a recipient complains
        or a regulator asks.
      </p>

      <h2>What doesn't count as consent</h2>
      <ul>
        <li>A business card at a conference (unless the card says "email me")</li>
        <li>A scraped LinkedIn profile</li>
        <li>Buying a list</li>
        <li>"They downloaded a whitepaper three years ago"</li>
      </ul>
    </MarketingPage>
  );
}
