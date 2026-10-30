import { describe, it, expect } from "bun:test";
import {
  applyMergeTags, listMergeTags, contactToValues, parseAddressList, invalidAddresses,
  headerToVar, normalizeHeader,
} from "../src/lib/automation/merge.server";

describe("merge engine", () => {
  it("fills variables with spaces in the name", () => {
    const r = applyMergeTags("Hello {{name 2}} of {{company}}", { "name 2": "Ms. Rao", company: "Acme" });
    expect(r.output).toBe("Hello Ms. Rao of Acme");
    expect(r.missing).toEqual([]);
  });

  it("applies fallbacks and reports missing values without leaving raw tags", () => {
    const r = applyMergeTags("Hi {{first name | fallback: there}}, {{role}} role", { "first name": "" });
    expect(r.output).toBe("Hi there,  role");
    expect(r.missing).toEqual(["role"]);
  });

  it("escapes HTML in bodies but not in subjects", () => {
    const values = contactToValues({ email: "a@b.co", name: 'Eve <script>alert(1)</script>' });
    const body = applyMergeTags("<p>Hi {{name}}</p>", values, { escapeHtml: true });
    expect(body.output).toBe("<p>Hi Eve &lt;script&gt;alert(1)&lt;/script&gt;</p>");
    const subject = applyMergeTags("Hi {{name}}", values);
    expect(subject.output).toContain("<script>");
  });

  it("maps custom columns and skips reserved headers", () => {
    expect(headerToVar("Industry")).toEqual({ key: "industry", reserved: false });
    expect(headerToVar("CC")).toEqual({ key: "cc", reserved: true });
    expect(headerToVar("Follow-up CC")).toEqual({ key: "follow-up cc", reserved: true });
    const values = contactToValues({ email: "a@b.co", custom: { Industry: "Fintech", "Dept Name": "Growth" } });
    expect(values.industry).toBe("Fintech");
    expect(values["dept name"]).toBe("Growth");
    expect(values.cc).toBeUndefined();
  });

  it("lists every tag used, normalised", () => {
    expect(listMergeTags("{{Name}} {{ name 2 }} {{first name | fallback: x}}")).toEqual(["name", "name 2", "first name"]);
  });

  it("normalises messy headers consistently", () => {
    expect(normalizeHeader("  First   NAME ")).toBe("first name");
  });
});

describe("address lists", () => {
  it("splits on commas and semicolons", () => {
    expect(parseAddressList("a@x.com; b@y.com, c@z.com")).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
    expect(parseAddressList(null)).toEqual([]);
  });
  it("flags invalid addresses so drafts are never created with a bad CC", () => {
    expect(invalidAddresses(["ok@x.com", "not-an-email", "a@b"])).toEqual(["not-an-email", "a@b"]);
  });
});
