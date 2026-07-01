import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Try existing session first
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return { user: session.user };

    // Silently create an anonymous account so the user can immediately
    // explore, compose, add recipients, and interact without any signup gate.
    // Real identity is captured later on the Profile tab + at purchase time.
    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (!error && anon.user) return { user: anon.user };

    // Absolute fallback: fetch user again (in case of race)
    const { data } = await supabase.auth.getUser();
    return { user: data.user ?? null };
  },
  component: () => <Outlet />,
});
