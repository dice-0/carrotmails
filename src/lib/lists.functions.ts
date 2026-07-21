import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const contactInput = z.object({
  email: z.string().max(320),
  vars: z.record(z.string().max(64), z.string().max(2000)).default({}),
});
const importInput = z.object({
  name: z.string().trim().min(1).max(120),
  contacts: z.array(contactInput).min(1).max(5000),
  consentConfirmed: z.literal(true, {
    message: "You must confirm every contact opted in before importing.",
  }),
  consentSource: z.string().trim().min(3).max(500),
});

export const listContactLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contact_lists")
      .select("id, name, contact_count, created_at, updated_at, consent_confirmed, consent_source, consent_confirmed_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const importContactList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => importInput.parse(input))
  .handler(async ({ data, context }) => {
    const unique = new Map<string, Record<string, string>>();
    let invalid = 0;
    let duplicates = 0;
    for (const contact of data.contacts) {
      const email = contact.email.trim().toLowerCase();
      if (!emailPattern.test(email)) {
        invalid += 1;
        continue;
      }
      if (unique.has(email)) {
        duplicates += 1;
        continue;
      }
      unique.set(email, contact.vars);
    }

    const emails = [...unique.keys()];
    const suppressed = new Set<string>();
    for (let i = 0; i < emails.length; i += 500) {
      const { data: rows, error } = await context.supabase
        .from("suppressions")
        .select("email")
        .in("email", emails.slice(i, i + 500));
      if (error) throw new Error(error.message);
      rows?.forEach((row) => suppressed.add(row.email.toLowerCase()));
    }
    const clean = emails.filter((email) => !suppressed.has(email));
    if (clean.length === 0) throw new Error("No clean contacts remain after hygiene checks");

    const { data: list, error: listError } = await context.supabase
      .from("contact_lists")
      .insert({
        name: data.name,
        user_id: context.userId,
        contact_count: clean.length,
        consent_confirmed: true,
        consent_source: data.consentSource,
        consent_confirmed_at: new Date().toISOString(),
      })
      .select("id, name, contact_count, created_at, updated_at, consent_confirmed, consent_source, consent_confirmed_at")
      .single();
    if (listError) throw new Error(listError.message);

    const nowIso = new Date().toISOString();
    const rows = clean.map((email) => ({
      list_id: list.id,
      user_id: context.userId,
      email,
      vars: unique.get(email) ?? {},
      consent_source: data.consentSource,
      consent_confirmed_at: nowIso,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await context.supabase.from("contacts").insert(rows.slice(i, i + 500));
      if (error) {
        await context.supabase.from("contact_lists").delete().eq("id", list.id);
        throw new Error(error.message);
      }
    }
    return { list, report: { imported: clean.length, invalid, duplicates, suppressed: suppressed.size } };
  });

export const deleteContactList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contact_lists").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });