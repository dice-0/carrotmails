import { createFileRoute, Link } from "@tanstack/react-router";
import { CarrotLogo } from "@/components/CarrotLogo";

export const Route = createFileRoute("/terms")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Terms of Service | Carrot Mails" },
      { name: "description", content: "The terms that govern your use of Carrot Mails, including acceptable use, billing, and account termination." },
      { property: "og:title", content: "Terms of Service | Carrot Mails" },
      { property: "og:url", content: "https://carrotmails.work/terms" },
    ],
    links: [{ rel: "canonical", href: "https://carrotmails.work/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <CarrotLogo size={32} />
            <span className="font-mono text-sm uppercase tracking-widest">Carrot Mails</span>
          </Link>
          <Link to="/" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            ← Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Last updated: June 18, 2026
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-foreground">
          <section>
            <h2 className="text-xl font-semibold">1. Acceptance</h2>
            <p className="mt-2 text-muted-foreground">
              By creating an account or using Carrot Mails (the "Service"), you agree to these Terms. If you do not agree,
              do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. The Service</h2>
            <p className="mt-2 text-muted-foreground">
              Carrot Mails lets you send personalized email from a Gmail or Outlook mailbox you own and have authorized.
              We do not provide the mailbox itself; sending is subject to the limits and policies of your email provider.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Account and eligibility</h2>
            <p className="mt-2 text-muted-foreground">
              You must be at least 13 years old (or the age of digital consent in your country) and capable of forming a
              binding contract. You are responsible for activity under your account and for keeping credentials safe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Acceptable use</h2>
            <p className="mt-2 text-muted-foreground">You agree not to use the Service to:</p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Send spam, unsolicited bulk email, phishing, malware, or deceptive content.</li>
              <li>Violate CAN-SPAM, CASL, GDPR, ePrivacy, or any other applicable anti-spam or privacy law.</li>
              <li>Send to recipients who have not consented or with whom you have no prior relationship.</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation.</li>
              <li>Circumvent quota, rate limits, or abuse-prevention systems.</li>
              <li>Reverse-engineer, resell, or sublicense the Service without permission.</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Every campaign must include a working unsubscribe mechanism and your real sender identity.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Your content</h2>
            <p className="mt-2 text-muted-foreground">
              You retain ownership of recipient lists and message content you upload. You grant us a limited license to
              store, process, and transmit that content solely to operate the Service for you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Billing</h2>
            <p className="mt-2 text-muted-foreground">
              Paid plans renew automatically until cancelled. Prices may change with notice. Except where required by law,
              payments are non-refundable. Promotional or "lifetime" pricing applies only to the features available at the
              time of purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Suspension and termination</h2>
            <p className="mt-2 text-muted-foreground">
              We may suspend or terminate accounts that violate these Terms, abuse the Service, harm recipients, or
              endanger sender reputation. You may stop using the Service at any time and request deletion of your data
              as described in our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Third-party services</h2>
            <p className="mt-2 text-muted-foreground">
              The Service integrates with Gmail, Outlook, and other providers. Your use of those services is governed by
              their own terms. We are not responsible for outages, policy changes, or actions taken by them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Disclaimer</h2>
            <p className="mt-2 text-muted-foreground">
              The Service is provided "as is" without warranties of any kind, express or implied. We do not guarantee
              deliverability, inbox placement, or uninterrupted availability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Limitation of liability</h2>
            <p className="mt-2 text-muted-foreground">
              To the maximum extent permitted by law, Carrot Mails will not be liable for indirect, incidental, special,
              consequential, or punitive damages, or for any loss of profits, revenue, data, or goodwill. Our aggregate
              liability for any claim is limited to the amount you paid us in the 3 months preceding the event giving
              rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Indemnity</h2>
            <p className="mt-2 text-muted-foreground">
              You agree to indemnify and hold Carrot Mails harmless from claims arising out of your content, your use of
              the Service, or your violation of these Terms or any law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">12. Changes</h2>
            <p className="mt-2 text-muted-foreground">
              We may update these Terms. Material changes will be announced in-app or by email. Continued use after a
              change means you accept the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">13. Contact</h2>
            <p className="mt-2 text-muted-foreground">
              Questions: <a href="mailto:work.josephraj@gmail.com" className="text-primary underline">work.josephraj@gmail.com</a>.
            </p>
          </section>
        </div>

        <footer className="mt-16 flex items-center justify-between border-t border-border pt-6 font-mono text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">© Carrot Mails</Link>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
