// Merge-tag engine for the Automation module.
//
// Tags look like {{name}}, {{name 2}}, {{first name | fallback: there}}.
// Variable names may contain spaces; headers are normalised (lowercase,
// trimmed, collapsed whitespace) so CSV columns map safely to variables.
// Values inserted into HTML bodies are HTML-escaped; subjects are plain text.

export type ContactValues = {
  // Known structured fields
  email?: string;
  name?: string;
  "first name"?: string;
  "name 2"?: string;
  company?: string;
  role?: string;
  // Any custom column, keyed by normalised header
  [key: string]: string | undefined;
};

export function normalizeHeader(h: string): string {
  return String(h).toLowerCase().replace(/\s+/g, " ").trim();
}

// Reserved column names that map to structured contact fields, not custom vars.
const RESERVED = new Set(["email", "status", "cc", "bcc", "follow-up cc", "followup cc"]);

export const TAG_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function parseTag(inner: string): { name: string; fallback?: string } {
  const fallbackMatch = inner.match(/^(.*?)\s*\|\s*fallback\s*:\s*(.*)$/i);
  if (fallbackMatch) {
    return { name: normalizeHeader(fallbackMatch[1]), fallback: fallbackMatch[2] };
  }
  return { name: normalizeHeader(inner) };
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Resolve every tag in a template against a contact's values.
// Returns the filled template, the list of tags that had no value and no
// fallback, and the list of tag names encountered (for the composer dropdown).
export function applyMergeTags(
  template: string,
  values: ContactValues,
  opts: { escapeHtml?: boolean } = {},
): { output: string; missing: string[]; used: string[] } {
  const missing: string[] = [];
  const used: string[] = [];
  const output = template.replace(TAG_PATTERN, (_m, inner: string) => {
    const { name, fallback } = parseTag(inner);
    if (!used.includes(name)) used.push(name);
    let value = values[name];
    if (value === undefined || value === null || String(value).trim() === "") {
      if (fallback !== undefined) {
        value = fallback;
      } else {
        if (!missing.includes(name)) missing.push(name);
        return ""; // never leave a raw unresolved tag in the output
      }
    }
    const s = String(value).replace(/[\r\n]+/g, " ").trim();
    return opts.escapeHtml ? escapeHtml(s) : s;
  });
  return { output, missing, used };
}

export function listMergeTags(template: string): string[] {
  const names: string[] = [];
  for (const m of template.matchAll(TAG_PATTERN)) {
    const { name } = parseTag(m[1]);
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

// Build per-recipient values from a contact row (structured fields + custom).
export function contactToValues(c: {
  email: string;
  name?: string | null;
  first_name?: string | null;
  name2?: string | null;
  company?: string | null;
  role?: string | null;
  custom?: Record<string, unknown> | null;
}): ContactValues {
  const values: ContactValues = { email: c.email };
  if (c.name) values.name = c.name;
  if (c.first_name) values["first name"] = c.first_name;
  if (c.name2) values["name 2"] = c.name2;
  if (c.company) values.company = c.company;
  if (c.role) values.role = c.role;
  for (const [k, v] of Object.entries(c.custom ?? {})) {
    const nk = normalizeHeader(k);
    if (!RESERVED.has(nk) && v !== null && v !== undefined) values[nk] = String(v);
  }
  return values;
}

// Split a CC/BCC field into validated addresses (comma or semicolon separated).
export function parseAddressList(v: string | null | undefined): string[] {
  if (!v) return [];
  return String(v)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>.]+\.[^\s@,;<>]{2,}$/;
export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

// Validate a whole address list; returns the invalid entries.
export function invalidAddresses(list: string[]): string[] {
  return list.filter((a) => !isValidEmail(a));
}

// Normalise CSV headers to variable names, flagging reserved columns.
export function headerToVar(h: string): { key: string; reserved: boolean } {
  const key = normalizeHeader(h);
  return { key, reserved: RESERVED.has(key) };
}
