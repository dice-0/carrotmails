import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminEmail, HQ_ACCESS_KEY, HQ_ENTITLEMENT } from "./admin-access";

async function hasHqEntitlement(supabase: any, userId: string) {
  const { data } = await supabase
    .from("billing_entitlements")
    .select("entitlement, active, expires_at")
    .eq("user_id", userId)
    .eq("active", true);
  const now = Date.now();
  return (data ?? []).some(
    (i: { entitlement: string; expires_at: string | null }) =>
      i.entitlement === HQ_ENTITLEMENT && (!i.expires_at || new Date(i.expires_at).getTime() > now),
  );
}

/**
 * Anyone who opens the hidden HQ link with the correct key gets HQ full access
 * permanently attached to their account.
 */
export const claimHqAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string }) => ({ key: String(input?.key ?? "") }))
  .handler(async ({ data, context }) => {
    if (data.key !== HQ_ACCESS_KEY) return { granted: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("billing_entitlements").upsert(
      {
        user_id: context.userId,
        entitlement: HQ_ENTITLEMENT,
        source_id: "hq-link",
        active: true,
        expires_at: null,
      },
      { onConflict: "user_id,entitlement" },
    );
    return { granted: true as const };
  });

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    const isAdmin = isAdminEmail(email) || (await hasHqEntitlement(context.supabase, context.userId));
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
