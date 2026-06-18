import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const fieldSchema = z.object({
  id: z.string().min(1).max(40).regex(/^[a-z][a-z0-9_]*$/i),
  label: z.string().min(1).max(80),
  type: z.enum(["email", "text", "tel", "url"]).default("text"),
  required: z.boolean().default(false),
});

const formInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  fields: z.array(fieldSchema).min(1).max(10),
  successMessage: z.string().max(500).default("Thanks, you're subscribed."),
  redirectUrl: z.string().url().max(500).optional().or(z.literal("")),
  listId: z.string().uuid().optional().nullable(),
});

function slugify(s: string) {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "form";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export const listForms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("forms")
      .select("id, slug, name, fields, success_message, redirect_url, list_id, submission_count, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => formInput.parse(input))
  .handler(async ({ data, context }) => {
    const hasEmail = data.fields.some((f) => f.type === "email" || f.id === "email");
    if (!hasEmail) throw new Error("At least one email field is required");
    const payload = {
      user_id: context.userId,
      name: data.name,
      fields: data.fields,
      success_message: data.successMessage,
      redirect_url: data.redirectUrl || null,
      list_id: data.listId || null,
    };
    const query = data.id
      ? context.supabase.from("forms").update(payload).eq("id", data.id).select().single()
      : context.supabase.from("forms").insert({ ...payload, slug: slugify(data.name) }).select().single();
    const { data: saved, error } = await query;
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("forms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFormSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ formId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("form_submissions")
      .select("id, email, data, created_at")
      .eq("form_id", data.formId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
