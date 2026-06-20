import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CarrotLogo } from "@/components/CarrotLogo";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/app" });
  },
  head: () => ({
    meta: [
      { title: "Carrot Mails: mass mail from your own inbox" },
      { name: "description", content: "Send personalized bulk email from your Gmail or Outlook inbox. Smart variables, reply detection, suppression, and deliverability built in. From $3.50/mo." },
      { name: "keywords", content: "bulk email, mass email, mail merge, cold email, Gmail mass mail, Outlook mail merge, email campaigns, personalized email, sales outreach" },
      { property: "og:title", content: "Carrot Mails: mass mail from your own inbox" },
      { property: "og:description", content: "Personalized bulk email from your Gmail or Outlook inbox. Smart variables, reply detection, deliverability built in." },
      { property: "og:url", content: "https://carrotmails.work/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cbdb7b89-623f-4bfb-9977-c5071a0b63d9/id-preview-f349f1fd--cf95264a-acbe-437f-9c02-4e80585fd74f.lovable.app-1781685610916.png" },
      { name: "twitter:title", content: "Carrot Mails: mass mail from your own inbox" },
      { name: "twitter:description", content: "Personalized bulk email from your Gmail or Outlook. Smart variables, reply detection, deliverability built in." },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cbdb7b89-623f-4bfb-9977-c5071a0b63d9/id-preview-f349f1fd--cf95264a-acbe-437f-9c02-4e80585fd74f.lovable.app-1781685610916.png" },
    ],
    links: [{ rel: "canonical", href: "https://carrotmails.work/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "What is Carrot Mails?", acceptedAnswer: { "@type": "Answer", text: "Carrot Mails sends personalized bulk email from your own Gmail or Outlook inbox, with smart variables, reply detection, and built-in deliverability." } },
            { "@type": "Question", name: "How much does Carrot Mails cost?", acceptedAnswer: { "@type": "Answer", text: "The Pro plan is $3.50 per month and includes 5,000 sends. Lifetime access with unlimited sending is a one-time $49.50 payment, limited to the first 100 buyers." } },
            { "@type": "Question", name: "Which mailboxes are supported?", acceptedAnswer: { "@type": "Answer", text: "Carrot Mails connects to Gmail and Outlook via OAuth. Carrot Mails never stores your password." } },
            { "@type": "Question", name: "Does Carrot Mails handle replies and unsubscribes?", acceptedAnswer: { "@type": "Answer", text: "Yes. Replies are detected automatically and future sends to that recipient pause. Bounces and unsubscribes flow into a global suppression list." } },
          ],
        }),
      },
    ],
  }),
  component: PreviewDashboard,
});

const NAV = ["Compose", "Campaigns", "Templates", "Lists", "Mailboxes", "Automation"];

const TILES = [
  { k: "From your inbox", v: "Connect Gmail or Outlook. Sends look personal because they are." },
  { k: "Real personalization", v: "{{name|fallback}}, spintax, conditionals, AI rewrites per recipient." },
  { k: "Reply detection", v: "When someone replies, we auto-pause future sends to them." },
  { k: "List hygiene", v: "Dedupe, syntax + MX checks, automatic suppression for bounces." },
];

function PreviewDashboard() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* App-shell preview, deliberately styled to match /app */}
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border p-6 md:flex">
          <CarrotLogo size={40} className="mb-10" />
          <nav className="flex flex-col gap-1 font-mono text-xs uppercase tracking-widest">
            {NAV.map((n, i) => (
              <span key={n} className={`px-2 py-1.5 ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>{n}</span>
            ))}
          </nav>
          <div className="mt-auto pt-6 font-mono text-[11px] text-muted-foreground">
            <div>not signed in</div>
          </div>
        </aside>

        <main className="min-h-screen flex-1">
          {/* Top bar with the highlighted Sign-in CTA */}
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4 md:px-10">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              preview · sign in to send
            </div>
            <div className="flex items-center gap-3">
              <Link to="/auth" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
              <Link
                to="/auth"
                className="relative inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary)_25%,transparent)] transition hover:opacity-90"
              >
                Get started, free
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          <div className="px-6 py-10 md:px-10">
            {/* Hero copy framed as a workspace headline */}
            <div className="mb-10">
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
                Mass mail, <span className="text-primary">delivered fresh</span>.
              </h1>
              <p className="mt-3 max-w-xl text-base text-muted-foreground">
                Send personalized email at scale from the inbox you already use. None of the bloat. None of the spam‑flag risk.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              {/* LEFT: a faux composer that mirrors /app */}
              <section className="space-y-5" aria-labelledby="composer-heading">
                <h2 id="composer-heading" className="sr-only">Compose your message</h2>
                <FauxField label="From">
                  <div className="border-b border-border py-2 text-sm text-muted-foreground">you@your-inbox.com</div>
                </FauxField>
                <FauxField label="Subject" hint="Use {{name}} or any column from your list">
                  <div className="border-b border-border py-2 text-base">Quick hello, {"{{name}}"}</div>
                </FauxField>
                <FauxField label="Body" hint="Paste from Word keeps tables & formatting.">
                  <div className="space-y-2 border border-border bg-card p-4 text-[15px] leading-relaxed">
                    <p>Hi {"{{name}}"},</p>
                    <p>I wanted to share something with you. Take a look at this short demo.</p>
                    <p>Best,<br/>Me</p>
                  </div>
                </FauxField>
                <FauxField label="Recipients" hint="CSV or TSV. First row = headers (email required).">
                  <pre className="border border-border bg-background p-3 font-mono text-xs leading-relaxed text-muted-foreground">{`email,name,company
ada@hey.com,Ada,Analytica
grace@hey.com,Grace,USN`}</pre>
                </FauxField>

                <div className="flex items-center justify-between pt-2">
                  <div className="font-mono text-xs text-muted-foreground">2 recipients ready</div>
                  <Link
                    to="/auth"
                    className="bg-primary px-6 py-2.5 text-sm font-medium tracking-wide text-primary-foreground transition hover:opacity-90"
                  >
                    Sign in to send →
                  </Link>
                </div>
              </section>

              {/* RIGHT: marketing copy as "empty states" inside the dashboard */}
              <section className="space-y-6 lg:sticky lg:top-10 lg:self-start" aria-labelledby="features-heading">
                <h2 id="features-heading" className="sr-only">Powerful features</h2>
                <div className="border border-border bg-card p-6">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Preview</div>
                  <div className="mt-3 text-base font-medium">Quick hello, Ada</div>
                  <p className="mt-3 text-[15px] leading-relaxed text-foreground">
                    Hi Ada, I wanted to share something with you. Take a look at this short demo.
                  </p>
                  <p className="mt-2 text-[15px] leading-relaxed">Best,<br/>Me</p>
                </div>

                <div className="grid gap-px bg-border md:grid-cols-2">
                  {TILES.map((t) => (
                    <div key={t.k} className="bg-background p-5">
                      <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t.k}</div>
                      <p className="mt-2 text-sm leading-relaxed text-foreground">{t.v}</p>
                    </div>
                  ))}
                </div>

                <div className="border border-border bg-card p-6">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Mailboxes</div>
                  <p className="mt-2 text-sm text-muted-foreground">No mailbox connected. After sign‑in, connect your Gmail or Outlook in one click. Carrot Mails never stores your password.</p>
                  <Link to="/auth" className="mt-4 inline-flex items-center gap-2 border border-border px-4 py-2 text-sm hover:bg-muted">
                    Continue with Google →
                  </Link>
                </div>

                <div className="border border-primary/40 bg-background p-6">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-accent">Launch pricing</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">limited</div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-foreground">$3.50</span>
                    <span className="text-sm text-muted-foreground">/ month, 5,000 sends</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Or pay <span className="font-medium text-foreground">$49.50 once</span> for lifetime access with unlimited sending. First 100 buyers only, price scales up over time.
                  </p>
                  <Link to="/auth" className="mt-4 inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                    Claim launch price →
                  </Link>
                </div>
              </section>
            </div>

            <footer className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 font-mono text-xs text-muted-foreground md:flex-row md:items-center">
              <span>© Carrot Mails</span>
              <div className="flex items-center gap-4">
                <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
                <Link to="/terms" className="hover:text-foreground">Terms</Link>
                <a href="mailto:work.josephraj@gmail.com" className="hover:text-foreground">Contact</a>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function FauxField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
