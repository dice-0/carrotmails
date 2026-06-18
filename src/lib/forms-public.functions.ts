import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public, no-auth form fetch + submit. Uses supabaseAdmin to bypass RLS
// because the submitter is anonymous; only minimal fields are returned.

const slugSchema = z.object({ slug: z.string().min(1).max(80) });
const submitSchema = z.object({
  slug: z.string().min(1).max(80),
  values: z.record(z.string().max(40), z.string().max(2000)).default({}),
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const getPublicForm = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => slugSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: form, error } = await supabaseAdmin
      .from("forms")
      .select("id, slug, name, fields, success_message, redirect_url")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!form) throw new Error("Form not found");
    return form;
  });

export const submitPublicForm = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: form, error } = await supabaseAdmin
      .from("forms")
      .select("id, user_id, fields, success_message, redirect_url, list_id, submission_count")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!form) throw new Error("Form not found");

    const fields = (form.fields as { id: string; type: string; required: boolean }[]) ?? [];
    const cleaned: Record<string, string> = {};
    let email = "";
    for (const f of fields) {
      const raw = (data.values[f.id] ?? "").trim();
      if (f.required && !raw) throw new Error(`${f.id} is required`);
      if (!raw) continue;
      if (raw.length > 2000) throw new Error(`${f.id} is too long`);
      cleaned[f.id] = raw;
      if (f.type === "email" || f.id === "email") email = raw.toLowerCase();
    }
    if (!email || !emailPattern.test(email)) throw new Error("A valid email is required");

    // Suppression check
    const { data: sup } = await supabaseAdmin.from("suppressions").select("email").eq("email", email).maybeSingle();
    if (sup) {
      // Pretend success to avoid leaking info
      return { ok: true, redirect: form.redirect_url ?? null, message: form.success_message };
    }

    const { error: insErr } = await supabaseAdmin.from("form_submissions").insert({
      form_id: form.id,
      user_id: form.user_id,
      email,
      data: cleaned,
    });
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin.from("forms").update({ submission_count: form.submission_count + 1 }).eq("id", form.id);

    if (form.list_id) {
      const vars: Record<string, string> = {};
      for (const [k, v] of Object.entries(cleaned)) if (k !== "email") vars[k] = v;
      // Best-effort insert; ignore conflict
      await supabaseAdmin.from("contacts").insert({
        list_id: form.list_id,
        user_id: form.user_id,
        email,
        vars,
      });
    }

    return { ok: true, redirect: form.redirect_url ?? null, message: form.success_message };
  });
