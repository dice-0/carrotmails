import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHmac, randomUUID } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Minimal scopes for send-only mailing.
// openid/email/profile: identify the connected mailbox (non-sensitive).
// gmail.send: send mail on the user's behalf (restricted, but lightest review path).
// Do NOT add gmail.readonly or gmail.modify unless a feature truly needs them;
// each extra restricted scope expands Google's verification requirements.
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

function stateSecret() {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Server not configured");
  return s;
}

export const getGoogleAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID is not set");
    const req = getRequest();
    const origin = new URL(req.url).origin;
    const redirectUri = `${origin}/api/public/oauth/google/callback`;
    const nonce = randomUUID();
    const expires = Date.now() + 10 * 60 * 1000;
    const payload = `${context.userId}.${nonce}.${expires}`;
    const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex");
    const state = Buffer.from(`${payload}.${sig}`).toString("base64url");

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GOOGLE_SCOPES);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return { url: url.toString() };
  });

export const listMailboxes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("mailbox_connections")
      .select("id, provider, email, daily_sent_count, daily_sent_date, daily_cap, scopes, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("mailbox_connections")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

