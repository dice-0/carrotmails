import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, breadcrumbSchema } from "@/components/MarketingPage";

const TITLE = "Consent-Based Email Marketing Software | Carrot Mails";
const DESC = "Send opt-in email to contacts who explicitly agreed to hear from you. Consent tracking, one-click unsubscribe, and Gmail-native delivery. From $3.50/month.";
const URL = "https://carrotmails.work/consent-based-email-marketing";

export const Route = createFileRoute("/consent-based-email-marketing")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "article" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(breadcrumbSchema([
          { name: "Home", slug: "/" },
          { name: "Consent-based email marketing", slug: "/consent-based-email-marketing" },
        ])),
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage
      eyebrow="Permission-based email"
      title="Consent-based email marketing software"
      intro="Carrot Mails is built for teams that only email people who asked to be emailed. Every contact carries a consent record, every send carries a one-click unsubscribe, and every reply pauses future outreach automatically."
    >
      <h2>Why consent-based, and why now</h2>
      <p>
        Gmail, Yahoo, and Microsoft now require bulk senders to prove recipients want their mail.
        Sender reputation, spam-rate thresholds under 0.3%, and mandatory RFC 8058 one-click
        unsubscribe headers all mean the same thing: unsolicited outreach is now a deliverability
        problem, not just a compliance problem.
      </p>
      <p>
        Carrot Mails enforces consent at the data layer. You cannot import a list without
        recording where consent was captured. You cannot send a campaign without ticking a
        confirmation that every recipient opted in.
      </p>

      <h2>How it works</h2>
      <h3>1. Capture consent, not just email addresses</h3>
      <p>
        When you add contacts, you record the source: signup form, checkout, event registration,
        or manual entry with proof. That record travels with the contact.
      </p>
      <h3>2. Send from your own inbox</h3>
      <p>
        Carrot Mails connects to your Gmail account and sends personalized email from your real
        address. Recipients see a normal message from someone they know, not a marketing blast
        from a third-party IP.
      </p>
      <h3>3. Honor every unsubscribe instantly</h3>
      <p>
        Every send includes List-Unsubscribe and List-Unsubscribe-Post headers (RFC 8058), plus a
        visible footer link. Unsubscribes flow into a global suppression list within seconds.
      </p>

      <h2>What you get</h2>
      <ul>
        <li><strong>Consent tracking</strong> per contact and per list</li>
        <li><strong>One-click unsubscribe</strong> compliant with Gmail and Yahoo 2024 rules</li>
        <li><strong>Reply detection</strong> that auto-pauses future sends</li>
        <li><strong>Global suppression list</strong> across every campaign</li>
        <li><strong>Personalization tokens</strong>, spintax, and per-recipient AI rewrites</li>
      </ul>

      <h2>Pricing</h2>
      <p>
        Premium is $3.50/month for 5,000 opt-in sends. Lifetime access with unlimited sending is
        a one-time $49.50, limited to the first 100 buyers. No free-tier sending, no cold
        outreach — that is the point.
      </p>
    </MarketingPage>
  );
}
