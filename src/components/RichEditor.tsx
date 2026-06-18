import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Underline } from "@tiptap/extension-underline";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { Highlight } from "@tiptap/extension-highlight";
import { Extension } from "@tiptap/core";
import { useEffect, useState } from "react";

// Custom FontSize mark (tiptap doesn't ship one; rides on TextStyle).
const FontSize = Extension.create({
  name: "fontSize",
  addOptions: () => ({ types: ["textStyle"] }),
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontSize?.replace(/['"]+/g, "") || null,
            renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
          },
        },
      },
    ];
  },
});

interface Props {
  value: string;
  onChange: (html: string) => void;
  spellcheck?: boolean;
}

const FONTS = [
  { label: "Sans", value: "Inter, -apple-system, system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Garamond", value: "Garamond, serif" },
];
const SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "30px"];
const COLORS = ["#111827", "#374151", "#6b7280", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#7c3aed"];

export function RichEditor({ value, onChange, spellcheck = true }: Props) {
  const [spell, setSpell] = useState(spellcheck);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      FontFamily.configure({ types: ["textStyle"] }),
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: false, HTMLAttributes: { class: "qq-table" } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "min-h-[260px] max-h-[480px] overflow-auto px-4 py-3 outline-none prose prose-sm max-w-none focus:outline-none",
        spellcheck: String(spell),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    editor?.setOptions({
      editorProps: {
        attributes: {
          class:
            "min-h-[260px] max-h-[480px] overflow-auto px-4 py-3 outline-none prose prose-sm max-w-none focus:outline-none",
          spellcheck: String(spell),
        },
      },
    });
  }, [editor, spell]);

  if (!editor) return null;

  return (
    <div className="border border-border bg-background focus-within:border-foreground">
      <Toolbar editor={editor} spell={spell} setSpell={setSpell} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, spell, setSpell }: { editor: Editor; spell: boolean; setSpell: (b: boolean) => void }) {
  const [importOpen, setImportOpen] = useState(false);
  const [importHtml, setImportHtml] = useState("");

  const btn =
    "rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition";
  const active = "bg-foreground text-background hover:bg-foreground hover:text-background";

  function addLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }
  function insertTable() {
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
  }
  function insertImage() {
    const url = window.prompt("Image URL");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }
  function insertButton() {
    const label = window.prompt("Button label", "Start creating") ?? "Click here";
    const url = window.prompt("Button URL", "https://") ?? "#";
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const html = `<p style="text-align:center"><a href="${href}" target="_blank" rel="noopener" style="display:inline-block;background:#6366f1;color:#ffffff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:500">${escapeHtml(label)}</a></p><p></p>`;
    editor.chain().focus().insertContent(html).run();
  }
  function insertCardRow() {
    const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0">
<tr>
<td width="48%" valign="top" style="background:#f5f3ef;padding:18px;border-radius:8px">
<div style="font-weight:600;margin-bottom:6px">Feature one</div>
<div style="color:#555;font-size:14px">Short description goes here.</div>
</td>
<td width="4%"></td>
<td width="48%" valign="top" style="background:#f5f3ef;padding:18px;border-radius:8px">
<div style="font-weight:600;margin-bottom:6px">Feature two</div>
<div style="color:#555;font-size:14px">Short description goes here.</div>
</td>
</tr></table><p></p>`;
    editor.chain().focus().insertContent(html).run();
  }
  function insertDivider() {
    editor.chain().focus().setHorizontalRule().run();
  }
  function insertSpacer() {
    editor.chain().focus().insertContent('<div style="height:24px"></div><p></p>').run();
  }
  function doImportHtml(replace: boolean) {
    const cleaned = sanitizeEmailHtml(importHtml);
    if (!cleaned.trim()) return;
    if (replace) {
      editor.chain().focus().setContent(cleaned, { emitUpdate: true }).run();
    } else {
      editor.chain().focus().insertContent(cleaned).run();
    }
    setImportOpen(false);
    setImportHtml("");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1.5">
        <select
          aria-label="Font family"
          className="rounded bg-transparent px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          onChange={(e) => e.target.value && editor.chain().focus().setFontFamily(e.target.value).run()}
          defaultValue=""
        >
          <option value="">Font</option>
          {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select
          aria-label="Font size"
          className="rounded bg-transparent px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          onChange={(e) => e.target.value && editor.chain().focus().setMark("textStyle", { fontSize: e.target.value }).run()}
          defaultValue=""
        >
          <option value="">Size</option>
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`${btn} font-semibold ${editor.isActive("bold") ? active : ""}`}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`${btn} italic ${editor.isActive("italic") ? active : ""}`}>I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`${btn} underline ${editor.isActive("underline") ? active : ""}`}>U</button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`${btn} line-through ${editor.isActive("strike") ? active : ""}`}>S</button>
        <span className="mx-1 h-4 w-px bg-border" />
        <input
          type="color"
          aria-label="Text color"
          title="Text color"
          className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
        <div className="hidden items-center gap-0.5 sm:flex">
          {COLORS.slice(0, 4).map((c) => (
            <button key={c} type="button" title={c} aria-label={`Color ${c}`} onClick={() => editor.chain().focus().setColor(c).run()} className="h-4 w-4 rounded-sm border border-border" style={{ background: c }} />
          ))}
        </div>
        <button type="button" title="Highlight" onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef3c7" }).run()} className={`${btn} ${editor.isActive("highlight") ? active : ""}`}>Mark</button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`${btn} ${editor.isActive("heading", { level: 2 }) ? active : ""}`}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`${btn} ${editor.isActive("bulletList") ? active : ""}`}>• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`${btn} ${editor.isActive("orderedList") ? active : ""}`}>1. List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`${btn} ${editor.isActive("blockquote") ? active : ""}`}>Quote</button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" title="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={`${btn} ${editor.isActive({ textAlign: "left" }) ? active : ""}`}>⬅</button>
        <button type="button" title="Align center" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={`${btn} ${editor.isActive({ textAlign: "center" }) ? active : ""}`}>⬌</button>
        <button type="button" title="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={`${btn} ${editor.isActive({ textAlign: "right" }) ? active : ""}`}>➡</button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" onClick={addLink} className={`${btn} ${editor.isActive("link") ? active : ""}`}>Link</button>
        <button type="button" onClick={insertImage} className={btn}>Image</button>
        <button type="button" onClick={insertButton} className={btn}>Button</button>
        <button type="button" onClick={insertCardRow} className={btn}>2-col</button>
        <button type="button" onClick={insertDivider} className={btn}>Divider</button>
        <button type="button" onClick={insertSpacer} className={btn}>Spacer</button>
        <button type="button" onClick={insertTable} className={btn}>Table</button>
        {editor.isActive("table") && (
          <>
            <span className="mx-1 h-4 w-px bg-border" />
            <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={btn}>+ Row</button>
            <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={btn}>+ Col</button>
            <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className={btn}>× Table</button>
          </>
        )}
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className={`${btn} bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary`}
          title="Paste HTML from any email and convert to blocks"
        >
          Import HTML
        </button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" onClick={() => editor.chain().focus().undo().run()} className={btn}>Undo</button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} className={btn}>Redo</button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => setSpell(!spell)}
          title="Toggle spellcheck"
          className={`${btn} ${spell ? active : ""}`}
        >
          Spell
        </button>
      </div>

      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setImportOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-lg border border-border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-base font-semibold">Import email HTML</div>
            <p className="mb-3 text-sm text-muted-foreground">
              Paste the HTML source from any email (e.g. "View source" or a saved .html file). We'll strip scripts and dangerous attributes, then convert it into editable blocks.
            </p>
            <textarea
              value={importHtml}
              onChange={(e) => setImportHtml(e.target.value)}
              rows={12}
              placeholder="<table>...your email html...</table>"
              className="w-full resize-none rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setImportOpen(false); setImportHtml(""); }}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doImportHtml(false)}
                disabled={!importHtml.trim()}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Insert at cursor
              </button>
              <button
                type="button"
                onClick={() => doImportHtml(true)}
                disabled={!importHtml.trim()}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Replace body
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function sanitizeEmailHtml(input: string): string {
  if (!input) return "";
  let html = input;
  // Extract <body> when a full document is pasted
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) html = bodyMatch[1];
  // Strip scripts, styles, comments, meta, link, head
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
  html = html.replace(/<(meta|link|head|title|base)\b[^>]*>/gi, "");
  // Drop event handlers (onclick, onload, etc.) and javascript: hrefs
  html = html.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "");
  html = html.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "");
  html = html.replace(/href\s*=\s*"(\s*javascript:[^"]*)"/gi, 'href="#"');
  html = html.replace(/href\s*=\s*'(\s*javascript:[^']*)'/gi, "href='#'");
  return html.trim();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
