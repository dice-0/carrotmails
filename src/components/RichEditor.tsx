import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
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
  const btn =
    "px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground transition";
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

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1">
      <select
        aria-label="Font family"
        className="bg-transparent px-1 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        onChange={(e) => e.target.value && editor.chain().focus().setFontFamily(e.target.value).run()}
        defaultValue=""
      >
        <option value="">Font</option>
        {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select
        aria-label="Font size"
        className="bg-transparent px-1 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        onChange={(e) => e.target.value && editor.chain().focus().setMark("textStyle", { fontSize: e.target.value }).run()}
        defaultValue=""
      >
        <option value="">Size</option>
        {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <span className="mx-1 h-4 w-px bg-border" />
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`${btn} ${editor.isActive("bold") ? active : ""}`}>B</button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`${btn} italic ${editor.isActive("italic") ? active : ""}`}>I</button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`${btn} underline ${editor.isActive("underline") ? active : ""}`}>U</button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`${btn} line-through ${editor.isActive("strike") ? active : ""}`}>S</button>
      <span className="mx-1 h-4 w-px bg-border" />
      <input
        type="color"
        aria-label="Text color"
        title="Text color"
        className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
      />
      <div className="hidden items-center gap-0.5 sm:flex">
        {COLORS.slice(0, 4).map((c) => (
          <button key={c} type="button" title={c} aria-label={`Color ${c}`} onClick={() => editor.chain().focus().setColor(c).run()} className="h-4 w-4 border border-border" style={{ background: c }} />
        ))}
      </div>
      <button type="button" title="Highlight" onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef3c7" }).run()} className={`${btn} ${editor.isActive("highlight") ? active : ""}`}>HL</button>
      <span className="mx-1 h-4 w-px bg-border" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`${btn} ${editor.isActive("heading", { level: 2 }) ? active : ""}`}>H</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`${btn} ${editor.isActive("bulletList") ? active : ""}`}>• list</button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`${btn} ${editor.isActive("orderedList") ? active : ""}`}>1. list</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`${btn} ${editor.isActive("blockquote") ? active : ""}`}>quote</button>
      <span className="mx-1 h-4 w-px bg-border" />
      <button type="button" title="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={`${btn} ${editor.isActive({ textAlign: "left" }) ? active : ""}`}>L</button>
      <button type="button" title="Align center" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={`${btn} ${editor.isActive({ textAlign: "center" }) ? active : ""}`}>C</button>
      <button type="button" title="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={`${btn} ${editor.isActive({ textAlign: "right" }) ? active : ""}`}>R</button>
      <span className="mx-1 h-4 w-px bg-border" />
      <button type="button" onClick={addLink} className={`${btn} ${editor.isActive("link") ? active : ""}`}>link</button>
      <button type="button" onClick={insertImage} className={btn}>img</button>
      <button type="button" onClick={insertButton} className={btn}>button</button>
      <button type="button" onClick={insertCardRow} className={btn}>2-col</button>
      <button type="button" onClick={insertDivider} className={btn}>—</button>
      <button type="button" onClick={insertSpacer} className={btn}>⎵</button>
      <button type="button" onClick={insertTable} className={btn}>table</button>
      {editor.isActive("table") && (
        <>
          <span className="mx-1 h-4 w-px bg-border" />
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={btn}>+row</button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={btn}>+col</button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className={btn}>×table</button>
        </>
      )}
      <span className="mx-1 h-4 w-px bg-border" />
      <button type="button" onClick={() => editor.chain().focus().undo().run()} className={btn}>undo</button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} className={btn}>redo</button>
      <span className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        onClick={() => setSpell(!spell)}
        title="Toggle spellcheck"
        className={`${btn} ${spell ? active : ""}`}
      >
        spell
      </button>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
