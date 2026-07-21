import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, breadcrumbSchema } from "@/components/MarketingPage";

const TITLE = "Gmail-Compliant Bulk Email Sender | Carrot Mails";
const DESC = "Send personalized bulk email from your Gmail account. RFC 8058 one-click unsubscribe, SPF/DKIM/DMARC-aware, spam-rate safe. Built for the 2024 Gmail sender rules.";
const URL = "https://carrotmails.work/gmail-bulk-email-sender";

export const Route = createFileRoute("/gmail-bulk-email-sender")({
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
          { name: "Gmail bulk email sender", slug: "/gmail-bulk-email-sender" },
        ])),
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage
      eyebrow="Gmail-native sending"
      title="Gmail-compliant bulk email sender"
      intro="Send personalized email at scale directly from your Gmail account, without violating Google's sender rules or triggering spam filters. Carrot Mails handles headers, throttling, and unsubscribes so your inbox stays clean."
    >
      <h2>Why sending from Gmail matters</h2>
      <p>
        Third-party sending platforms use shared IPs that get burned by other people's bad
        behavior. When you send from your own Gmail, your recipient sees a message from a person
        they recognize, and your delivery is tied to your own domain reputation, not someone
        else's.
      </p>

      <h2>Built for the 2024 Gmail sender rules</h2>
      <p>Google's bulk sender guidelines require, at minimum:</p>
      <ul>
        <li>SPF, DKIM, and DMARC alignment on your sending domain</li>
        <li>One-click unsubscribe headers (RFC 8058) on every commercial message</li>
        <li>A spam complaint rate under 0.3% (ideally under 0.1%)</li>
        <li>Only sending to recipients who explicitly opted in</li>
      </ul>
      <p>
        Carrot Mails injects List-Unsubscribe and List-Unsubscribe-Post headers automatically,
        adds a visible footer, throttles sends to avoid Gmail's per-account API quotas, and
        blocks campaigns that don't confirm consent.
      </p>

      <h2>What Carrot Mails does that a plain Gmail merge doesn't</h2>
      <ul>
        <li><strong>Per-recipient personalization</strong> with token fallbacks and conditionals</li>
        <li><strong>Reply detection</strong> — if someone replies, we pause future sends to them</li>
        <li><strong>Bounce and suppression handling</strong> so bad addresses never get re-tried</li>
        <li><strong>Rate-limited sending</strong> that stays inside Gmail's daily quota</li>
        <li><strong>Consent enforcement</strong> at import, at list creation, and at send time</li>
      </ul>

      <h2>Who it's for</h2>
      <p>
        Founders emailing their signup list, creators emailing their newsletter subscribers,
        agencies emailing their opted-in customers. Not for cold outreach. Not for scraped lists.
      </p>
    </MarketingPage>
  );
}
