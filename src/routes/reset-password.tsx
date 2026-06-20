import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CarrotLogo } from "@/components/CarrotLogo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password | Carrot Mails" },
      {
        name: "description",
        content: "Set a new password for your Carrot Mails account.",
      },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://carrotmails.work/reset-password" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link
          to="/"
          className="mb-10 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          aria-label="Back to Carrot Mails home"
        >
          <span className="font-mono text-xs uppercase tracking-widest">←</span>
          <CarrotLogo size={34} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleReset} className="mt-8 space-y-4">
          <div>
            <label htmlFor="new-password" className="sr-only">
              New password
            </label>
            <input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (8+ chars)"
              className="w-full border-b border-border bg-transparent px-0 py-2 text-base outline-none focus:border-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}