import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppPage } from "@/components/AppPage";
import { Button } from "@/components/ui/button";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";


export const Route = createFileRoute("/_authenticated/app/profile")({
  head: () => ({
    meta: [
      { title: "Profile | Carrot Mails" },
      { name: "description", content: "Set the email tied to your Carrot Mails account, subscription, and mailbox access." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const get = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const { data, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => get() });

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isAnon, setIsAnon] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setEmail(data.email ?? "");
      setDisplayName(data.display_name ?? "");
    }
  }, [data]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAnon(!!data.user?.is_anonymous);
      setAuthEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleGoogle() {
    setGoogleBusy(true);
    try {
      // Drop the anon session first so PKCE code exchange isn't racing
      // an existing session on the same tab (that's what causes
      // "failed to exchange authorization code" on return).
      if (isAnon) {
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
      }
      // redirect_uri MUST be a public same-origin URL, not a protected route.
      // Stash the intended destination for /auth to read after sign-in.
      try { sessionStorage.setItem("post_signin_redirect", "/app/profile"); } catch { /* ignore */ }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
        extraParams: { prompt: "select_account" },
      });
      if (result.error) toast.error(result.error.message ?? "Google sign-in failed.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleVerify() {
    const target = email.trim();
    if (!target) {
      toast.error("Enter your email first.");
      return;
    }
    setVerifyBusy(true);
    try {
      if (!isAnon && authEmail && authEmail.toLowerCase() === target.toLowerCase()) {
        toast.success("This email is already verified on your account.");
        return;
      }
      // Magic link: if an account already exists for this email (e.g. your paid
      // account created on another device), the link signs you INTO that
      // account — which is what "verify this is me" should do. If none exists,
      // Supabase creates one.
      const { error } = await supabase.auth.signInWithOtp({
        email: target,
        options: {
          emailRedirectTo: window.location.origin + "/auth",
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      toast.success("Sign-in link sent. Open it from your inbox on this device to continue.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setVerifyBusy(false);
    }
  }


  const needsLink = isAnon || !authEmail;
  const emailVerified = !!authEmail && authEmail.toLowerCase() === email.trim().toLowerCase();


  const save = useMutation({
    mutationFn: () => update({ data: { email: email.trim(), display_name: displayName.trim() } }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppPage
      eyebrow="Account"
      title="Your profile"
      description="The email you set here is your account identity: subscription ownership, mailbox linking, access recovery, and signing in from another device."
    >
      {isLoading ? (
        <p className="font-mono text-xs text-muted-foreground">Loading…</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="max-w-lg space-y-5"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium">Account email</label>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20"
                placeholder="you@example.com"
              />
              {emailVerified ? (
                <Button type="button" variant="outline" disabled className="shrink-0">
                  Verified
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogle}
                    disabled={googleBusy}
                    className="shrink-0 gap-2"
                    title="Sign in with Google"
                  >
                    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.9 6.2 29.7 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.9 7.2 29.7 5 24 5 16.3 5 9.7 9 6.3 14.7z"/>
                      <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.4C29.7 34.7 27 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.5 40 16.2 44 24 44z"/>
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.6 5.4C41.7 35 44 30 44 24c0-1.3-.1-2.3-.4-3.5z"/>
                    </svg>
                    {googleBusy ? "Opening…" : "Google"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVerify}
                    disabled={verifyBusy || !email.trim()}
                    className="shrink-0"
                    title="Send a verification link to this email"
                  >
                    {verifyBusy ? "Sending…" : "Verify"}
                  </Button>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {emailVerified
                ? "This email is verified and tied to your account."
                : "Sign in with Google, or click Verify to receive a confirmation link at the email above. Either way locks this email to your account so your plan follows you across devices."}
            </p>

          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Display name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20"
              placeholder="Ada Lovelace"
            />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-5">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {data?.complete ? "Profile complete" : "Profile incomplete"}
            </span>
            <Button type="submit" disabled={save.isPending || !email.trim() || !displayName.trim()}>
              {save.isPending ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      )}
    </AppPage>
  );
}
