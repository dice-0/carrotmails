import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminEmail } from "./admin-access";

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    const isAdmin = isAdminEmail(email);
    if (!isAdmin) return { isAdmin: false as const, email, mailbox: null, sentThisPeriod: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: mailbox }, { count }] = await Promise.all([
      supabaseAdmin
        .from("mailbox_connections")
        .select("email, display_name, status, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("email_send_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .gte("sent_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    return {
      isAdmin: true as const,
      email,
      mailbox: mailbox ?? null,
      sentThisPeriod: count ?? 0,
    };
  });
