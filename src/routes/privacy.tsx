import { createFileRoute, Link } from "@tanstack/react-router";
import { CarrotLogo } from "@/components/CarrotLogo";

export const Route = createFileRoute("/privacy")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Privacy Policy | Carrot Mails" },
      { name: "description", content: "How Carrot Mails collects, uses, stores, and protects your data, including Google user data accessed via Gmail OAuth." },
      { property: "og:title", content: "Privacy Policy | Carrot Mails" },
      { property: "og:url", content: "https://carrotmails.work/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://carrotmails.work/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
        <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Last updated: June 18, 2026
        </p>

        <div className="prose prose-invert mt-10 max-w-none space-y-8 text-[15px] leading-relaxed text-foreground">
          <section>
            <h2 className="text-xl font-semibold">1. Who we are</h2>
            <p className="mt-2 text-muted-foreground">
              Carrot Mails ("we", "us", "our") provides a tool that lets you send personalized bulk email from your own
              Gmail or Outlook inbox. This policy describes what data we collect, how we use it, and your rights.
              Contact: <a href="mailto:work.josephraj@gmail.com" className="text-primary underline">work.josephraj@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Data we collect</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-muted-foreground">
              <li><span className="text-foreground">Account data:</span> email address, name, and authentication identifiers when you sign up.</li>
              <li><span className="text-foreground">Mailbox connection data:</span> OAuth access and refresh tokens for the Gmail or Outlook account you connect, the email address of that mailbox, and the OAuth scopes you granted.</li>
              <li><span className="text-foreground">Send data:</span> recipient lists you upload, subject lines, message bodies, attachments, and send timestamps, kept so we can deliver, retry, and report on your campaigns.</li>
              <li><span className="text-foreground">Billing data:</span> processed by our payment provider; we store plan, status, and transaction references.</li>
              <li><span className="text-foreground">Operational logs:</span> minimal request and error logs for security and abuse prevention.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Google user data and Limited Use</h2>
            <p className="mt-2 text-muted-foreground">
              When you connect a Google account, we request the Gmail <code className="rounded bg-muted px-1 py-0.5 text-xs">gmail.send</code> scope
              so we can send messages on your behalf. We use Google user data only to provide and improve the user-facing features
              of Carrot Mails. Specifically:
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>We <span className="text-foreground">do not</span> use Google user data to serve ads.</li>
              <li>We <span className="text-foreground">do not</span> sell, rent, or share Google user data with third parties for any purpose other than providing the service.</li>
              <li>We <span className="text-foreground">do not</span> allow humans to read your Google user data, except (a) with your explicit consent, (b) where necessary for security investigations, (c) to comply with law, or (d) where the data has been aggregated and anonymized.</li>
              <li>We <span className="text-foreground">do not</span> use Google user data to train generalized AI models.</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Our use of information received from Google APIs adheres to the
              {" "}<a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-primary underline">Google API Services User Data Policy</a>,
              including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. How we use data</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Authenticate you and connect your mailboxes.</li>
              <li>Send the email campaigns you configure, from the inbox you connected.</li>
              <li>Show delivery status, quota, and history inside your account.</li>
              <li>Detect abuse (spam, phishing, suspicious volume) and enforce sending limits.</li>
              <li>Process billing and provide support.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Storage and security</h2>
            <p className="mt-2 text-muted-foreground">
              Data is stored on managed cloud infrastructure with encryption in transit (TLS) and at rest. OAuth tokens
              are stored in a restricted table that is not readable by application users; only privileged server code can
              decrypt and use them to call Gmail or Outlook on your behalf. Access is scoped per-user via row-level security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Sharing</h2>
            <p className="mt-2 text-muted-foreground">
              We share data only with subprocessors that are necessary to run the service: hosting and database, email
              delivery via Gmail/Outlook APIs at your request, and payment processing. We do not sell personal data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Retention and deletion</h2>
            <p className="mt-2 text-muted-foreground">
              You can disconnect a mailbox at any time, which deletes its stored OAuth tokens. You can request deletion
              of your account and associated data by emailing
              {" "}<a href="mailto:work.josephraj@gmail.com" className="text-primary underline">work.josephraj@gmail.com</a>.
              We honor deletion requests within 30 days, except where retention is required by law.
            </p>
            <p className="mt-2 text-muted-foreground">
              You may also revoke Carrot Mails' access to your Google Account at any time via
              {" "}<a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-primary underline">myaccount.google.com/permissions</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Your rights</h2>
            <p className="mt-2 text-muted-foreground">
              Depending on where you live, you may have rights to access, correct, export, or delete your personal data,
              and to object to or restrict certain processing. Contact us to exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Children</h2>
            <p className="mt-2 text-muted-foreground">
              Carrot Mails is not directed to children under 13 and we do not knowingly collect data from them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Changes</h2>
            <p className="mt-2 text-muted-foreground">
              We may update this policy. Material changes will be announced in-app or by email. Continued use after a
              change constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Contact</h2>
            <p className="mt-2 text-muted-foreground">
              Questions or requests: <a href="mailto:work.josephraj@gmail.com" className="text-primary underline">work.josephraj@gmail.com</a>.
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
