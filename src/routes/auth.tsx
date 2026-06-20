import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { CarrotLogo } from "@/components/CarrotLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in | Carrot Mails" },
      {
        name: "description",
        content:
          "Sign in or create your Carrot Mails account to access campaigns, templates, lists, mailboxes, and signup forms.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Sign in | Carrot Mails" },
      {
        property: "og:description",
        content:
          "Sign in or create your Carrot Mails account to access campaigns, templates, lists, and mailboxes.",
      },
      { property: "og:url", content: "https://carrotmails.work/auth" },
    ],
    links: [{ rel: "canonical", href: "https://carrotmails.work/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("Password reset link sent if an account exists for this email.");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: { full_name: name },
          },
        });
        if (error) throw error;
        setNeedsConfirmation(true);
        toast.success("Check your email for the confirmation link.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = error.message?.toLowerCase() ?? "";
          if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
            setNeedsConfirmation(true);
            toast.error("Please confirm your email first. We can resend the link below.");
            return;
          }
          throw error;
        }
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/app",
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!email) {
      toast.error("Enter your email first.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/app" },
      });
      if (error) throw error;
      toast.success("Confirmation link resent if this email is waiting for verification.");
      setNeedsConfirmation(true);
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
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create your account"
              : "Reset your password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Welcome back."
            : mode === "signup"
              ? "Send personalized mail from your own inbox. You'll connect Gmail after signup."
              : "Enter your email and we'll send a secure reset link."}
        </p>

        <form onSubmit={handleEmail} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="sr-only">
                Your name
              </label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full border-b border-border bg-transparent px-0 py-2 text-base outline-none focus:border-foreground"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full border-b border-border bg-transparent px-0 py-2 text-base outline-none focus:border-foreground"
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (8+ chars)"
                className="w-full border-b border-border bg-transparent px-0 py-2 text-base outline-none focus:border-foreground"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </button>
        </form>

        {mode === "signin" && (
          <button
            type="button"
            onClick={() => setMode("forgot")}
            className="mt-4 block w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </button>
        )}

        {(needsConfirmation || mode === "signup") && (
          <button
            type="button"
            onClick={resendConfirmation}
            disabled={busy}
            className="mt-4 block w-full text-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Resend confirmation link
          </button>
        )}

        <button
          onClick={() => {
            setNeedsConfirmation(false);
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          className="mt-6 block w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "No account? Create one" : "Have an account? Sign in"}
        </button>

        <p className="mt-6 text-center font-mono text-[11px] leading-relaxed text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/terms" className="underline hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
