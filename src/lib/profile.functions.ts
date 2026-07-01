import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const profileSchema = z.object({
  email: z.string().email().max(320),
  display_name: z.string().min(1).max(120),
});

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, display_name, created_at, updated_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const email =
      data?.email ??
      (typeof context.claims.email === "string" ? (context.claims.email as string) : "") ??
      "";
    const displayName = data?.display_name ?? "";
    return {
      email,
      display_name: displayName,
      complete: Boolean(email && displayName.trim()),
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .upsert(
        {
          id: context.userId,
          email: data.email,
          display_name: data.display_name,
        },
        { onConflict: "id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
