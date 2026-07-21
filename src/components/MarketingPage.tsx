import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CarrotLogo } from "@/components/CarrotLogo";

export function MarketingPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link to="/">
            <CarrotLogo size={32} />
          </Link>
          <nav className="flex items-center gap-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Link to="/blog" className="hover:text-foreground">Blog</Link>
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
            <Link
              to="/app"
              className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:bg-primary/90"
            >
              Try free
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        {eyebrow && (
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          {title}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{intro}</p>

        <div className="prose prose-neutral mt-12 max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-12 prose-h2:text-2xl prose-h3:text-lg prose-p:leading-relaxed prose-p:text-muted-foreground prose-a:text-primary prose-strong:text-foreground prose-li:text-muted-foreground">
          {children}
        </div>

        <div className="mt-16 rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Ready to send permission-based email?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            From your own Gmail. $3.50/month, 5,000 opt-in sends.
          </p>
          <Link
            to="/app"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open Carrot Mails
          </Link>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <div>© Carrot Mails</div>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/blog" className="hover:text-foreground">Blog</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function articleSchema(opts: {
  title: string;
  description: string;
  slug: string;
  datePublished: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    datePublished: opts.datePublished,
    dateModified: opts.datePublished,
    author: { "@type": "Organization", name: "Carrot Mails" },
    publisher: {
      "@type": "Organization",
      name: "Carrot Mails",
      logo: { "@type": "ImageObject", url: "https://carrotmails.work/favicon.svg" },
    },
    mainEntityOfPage: `https://carrotmails.work${opts.slug}`,
  };
}

export function breadcrumbSchema(items: { name: string; slug: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `https://carrotmails.work${it.slug}`,
    })),
  };
}
