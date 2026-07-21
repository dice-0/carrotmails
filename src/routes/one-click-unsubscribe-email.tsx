import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, breadcrumbSchema } from "@/components/MarketingPage";

const TITLE = "One-Click Unsubscribe Email Software (RFC 8058) | Carrot Mails";
const DESC = "Every send from Carrot Mails includes RFC 8058 List-Unsubscribe and List-Unsubscribe-Post headers. Compliant with Gmail and Yahoo bulk sender rules by default.";
const URL = "https://carrotmails.work/one-click-unsubscribe-email";

export const Route = createFileRoute("/one-click-unsubscribe-email")({
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
          { name: "One-click unsubscribe email", slug: "/one-click-unsubscribe-email" },
        ])),
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage
      eyebrow="RFC 8058 compliant"
      title="One-click unsubscribe email software"
      intro="Since February 2024, Gmail and Yahoo require every bulk commercial email to support one-click unsubscribe. Carrot Mails does this on every send, automatically, without extra setup."
    >
      <h2>What one-click unsubscribe actually means</h2>
      <p>
        It's more than a footer link. RFC 8058 defines two headers your email must include:
      </p>
      <ul>
        <li>
          <code>List-Unsubscribe: &lt;https://your-app.com/u/token&gt;</code>
        </li>
        <li>
          <code>List-Unsubscribe-Post: List-Unsubscribe=One-Click</code>
        </li>
      </ul>
      <p>
        When a recipient clicks Gmail's "Unsubscribe" button next to your sender name, Gmail
        sends an HTTP POST to your unsubscribe URL. You must process it within two seconds and
        stop sending to that recipient within 48 hours.
      </p>

      <h2>How Carrot Mails handles it</h2>
      <p>
        Every campaign gets both headers injected automatically. Every recipient gets a unique
        signed token. When Gmail or a recipient hits the URL, we suppress the address globally
        across your workspace within seconds, and every future campaign filters it out at send
        time.
      </p>

      <h2>Why this is a deliverability issue, not just a legal one</h2>
      <p>
        Gmail treats missing List-Unsubscribe headers as a signal of low-quality sending.
        Combined with a spam complaint rate above 0.3%, it will land your mail in the promotions
        tab or block it outright. RFC 8058 support isn't optional if you want to reach the inbox.
      </p>
    </MarketingPage>
  );
}
