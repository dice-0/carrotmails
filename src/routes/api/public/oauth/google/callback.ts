import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/oauth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const stateB64 = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");
        if (errorParam) return redirectTo(`/app/mailboxes?error=${encodeURIComponent(errorParam)}`);
        if (!code || !stateB64) return redirectTo(`/app/mailboxes?error=missing_params`);

        const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        if (!secret || !clientId || !clientSecret) {
          return redirectTo(`/app/mailboxes?error=not_configured`);
        }

        let userId: string;
        let returnOrigin = "https://carrotmails.work";
        try {
          const decoded = Buffer.from(stateB64, "base64url").toString("utf8");
          const parts = decoded.split(".");
          // New format: uid.nonce.exp.originB64.sig. Old 4-part states (before
          // the return-origin was added) fall back to the production origin.
          if (parts.length !== 4 && parts.length !== 5) throw new Error("state shape");
          const [uid, nonce, expStr, a3, sig] = parts;
          const originPart = parts.length === 5 ? a3 : "";
          const signedPayload =
            parts.length === 5 ? `${uid}.${nonce}.${expStr}.${a3}` : `${uid}.${nonce}.${expStr}`;
          const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
          const a = Buffer.from(sig, "hex");
          const b = Buffer.from(expected, "hex");
          if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("bad sig");
          if (Number(expStr) < Date.now()) throw new Error("expired");
          userId = uid;
          if (originPart) {
            const o = Buffer.from(originPart, "base64url").toString("utf8");
            if (
              o === "https://carrotmails.work" ||
              o === "https://www.carrotmails.work" ||
              o === "https://id-preview--cf95264a-acbe-437f-9c02-4e80585fd74f.lovable.app" ||
              o === "http://localhost:8080"
            ) {
              returnOrigin = o;
            }
          }
        } catch {
          return redirectTo(`/app/mailboxes?error=invalid_state`);
        }

        // Must match the redirect_uri used in the auth URL exactly, regardless
        // of which host served this callback.
        const redirectUri = `https://carrotmails.work/api/public/oauth/google/callback`;
        const tokRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });
        if (!tokRes.ok) {
          console.error("Google token exchange failed", await tokRes.text());
          return redirectTo(`/app/mailboxes?error=token_exchange`);
        }
        const tok = (await tokRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope: string;
        };

        const profRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
          headers: { Authorization: `Bearer ${tok.access_token}` },
        });
        if (!profRes.ok) {
          console.error("Gmail profile fetch failed", await profRes.text());
          return redirectTo(`/app/mailboxes?error=profile`);
        }
        const prof = (await profRes.json()) as { emailAddress: string };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();

        // Look up existing row to preserve a refresh_token if Google didn't send a new one
        const { data: existing } = await supabaseAdmin
          .from("mailbox_connections")
          .select("id, refresh_token")
          .eq("user_id", userId)
          .eq("provider", "gmail")
          .eq("email", prof.emailAddress)
          .maybeSingle();

        const refreshToken = tok.refresh_token ?? existing?.refresh_token ?? null;
        if (!refreshToken) {
          return redirectTo(`/app/mailboxes?error=no_refresh_token`);
        }

        const { error: upErr } = await supabaseAdmin
          .from("mailbox_connections")
          .upsert(
            {
              user_id: userId,
              provider: "gmail",
              email: prof.emailAddress,
              access_token: tok.access_token,
              refresh_token: refreshToken,
              expires_at: expiresAt,
              scopes: tok.scope,
              status: "active",
            },
            { onConflict: "user_id,provider,email" },
          );
        if (upErr) {
          console.error("mailbox upsert failed", upErr);
          return redirectTo(`/app/mailboxes?error=save`);
        }
        return redirectTo(`/app/mailboxes?connected=${encodeURIComponent(prof.emailAddress)}`);
      },
    },
  },
});

function redirectTo(path: string) {
  return new Response(null, { status: 302, headers: { Location: path } });
}