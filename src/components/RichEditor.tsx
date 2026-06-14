import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { useEffect } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

export function RichEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
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

  if (!editor) return null;

  return (
    <div className="border border-border bg-background focus-within:border-foreground">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
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

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`${btn} ${editor.isActive("bold") ? active : ""}`}>B</button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`${btn} italic ${editor.isActive("italic") ? active : ""}`}>I</button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`${btn} line-through ${editor.isActive("strike") ? active : ""}`}>S</button>
      <span className="mx-1 h-4 w-px bg-border" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`${btn} ${editor.isActive("heading", { level: 2 }) ? active : ""}`}>H</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`${btn} ${editor.isActive("bulletList") ? active : ""}`}>• list</button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`${btn} ${editor.isActive("orderedList") ? active : ""}`}>1. list</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`${btn} ${editor.isActive("blockquote") ? active : ""}`}>quote</button>
      <span className="mx-1 h-4 w-px bg-border" />
      <button type="button" onClick={addLink} className={`${btn} ${editor.isActive("link") ? active : ""}`}>link</button>
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
    </div>
  );
}
