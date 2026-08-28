import { useCallback, useEffect, useRef } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Highlighter, List, ListOrdered,
  Heading1, Heading2, Heading3, Quote, Code2, Table as TableIcon, Image as ImageIcon,
  Link2, Undo2, Redo2, RemoveFormatting, AlignLeft, AlignCenter, Minus, Palette,
} from "lucide-react";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

function Btn({
  onClick, title, children, active,
}: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground ${
        active ? "bg-accent text-foreground" : ""
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-border" />;

export function RichTextEditor({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtml = useRef<string>("");

  useEffect(() => {
    if (ref.current && value !== lastHtml.current) {
      ref.current.innerHTML = value;
      lastHtml.current = value;
    }
  }, [value]);

  const emit = useCallback(() => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastHtml.current = html;
    onChange(html);
  }, [onChange]);

  const cmd = useCallback(
    (command: string, arg?: string) => {
      ref.current?.focus();
      document.execCommand(command, false, arg);
      emit();
    },
    [emit],
  );

  const insertHtml = useCallback(
    (html: string) => {
      ref.current?.focus();
      document.execCommand("insertHTML", false, html);
      emit();
    },
    [emit],
  );

  const insertTable = () => {
    const cols = Number(prompt("Number of columns?", "3") ?? 0);
    const rows = Number(prompt("Number of rows (excluding header)?", "3") ?? 0);
    if (!cols || !rows) return;
    const head = `<tr>${Array.from({ length: cols }, (_, i) => `<th>Column ${i + 1}</th>`).join("")}</tr>`;
    const body = Array.from({ length: rows }, () => `<tr>${"<td>&nbsp;</td>".repeat(cols)}</tr>`).join("");
    insertHtml(`<table><thead>${head}</thead><tbody>${body}</tbody></table><p><br></p>`);
  };

  const insertImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = () => insertHtml(`<figure><img src="${fr.result}" alt="${file.name}" /><figcaption>${file.name}</figcaption></figure><p><br></p>`);
      fr.readAsDataURL(file);
    };
    input.click();
  };

  const insertLink = () => {
    const url = prompt("Link URL", "https://");
    if (url) cmd("createLink", url);
  };

  const setColor = () => {
    const color = prompt("Text colour (name or #hex)", "#4f46e5");
    if (color) cmd("foreColor", color);
  };

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-2xl border-b border-border bg-card/95 p-2 backdrop-blur">
        <Btn title="Undo" onClick={() => cmd("undo")}><Undo2 className="h-4 w-4" /></Btn>
        <Btn title="Redo" onClick={() => cmd("redo")}><Redo2 className="h-4 w-4" /></Btn>
        <Sep />
        <Btn title="Heading 1" onClick={() => cmd("formatBlock", "H1")}><Heading1 className="h-4 w-4" /></Btn>
        <Btn title="Heading 2" onClick={() => cmd("formatBlock", "H2")}><Heading2 className="h-4 w-4" /></Btn>
        <Btn title="Heading 3" onClick={() => cmd("formatBlock", "H3")}><Heading3 className="h-4 w-4" /></Btn>
        <Btn title="Paragraph" onClick={() => cmd("formatBlock", "P")}><AlignLeft className="h-4 w-4" /></Btn>
        <Sep />
        <Btn title="Bold" onClick={() => cmd("bold")}><Bold className="h-4 w-4" /></Btn>
        <Btn title="Italic" onClick={() => cmd("italic")}><Italic className="h-4 w-4" /></Btn>
        <Btn title="Underline" onClick={() => cmd("underline")}><Underline className="h-4 w-4" /></Btn>
        <Btn title="Strikethrough" onClick={() => cmd("strikeThrough")}><Strikethrough className="h-4 w-4" /></Btn>
        <Btn title="Highlight" onClick={() => insertHtml(`<mark>${document.getSelection()?.toString() || "highlight"}</mark>`)}><Highlighter className="h-4 w-4" /></Btn>
        <Btn title="Text colour" onClick={setColor}><Palette className="h-4 w-4" /></Btn>
        <Sep />
        <Btn title="Bullet list" onClick={() => cmd("insertUnorderedList")}><List className="h-4 w-4" /></Btn>
        <Btn title="Numbered list" onClick={() => cmd("insertOrderedList")}><ListOrdered className="h-4 w-4" /></Btn>
        <Btn title="Centre" onClick={() => cmd("justifyCenter")}><AlignCenter className="h-4 w-4" /></Btn>
        <Sep />
        <Btn title="Quote" onClick={() => cmd("formatBlock", "BLOCKQUOTE")}><Quote className="h-4 w-4" /></Btn>
        <Btn title="Code block" onClick={() => insertHtml("<pre><code>code here</code></pre><p><br></p>")}><Code2 className="h-4 w-4" /></Btn>
        <Btn title="Callout box" onClick={() => insertHtml('<div class="callout"><strong>Note:</strong> write here</div><p><br></p>')}><Quote className="h-4 w-4 rotate-180" /></Btn>
        <Btn title="Insert table" onClick={insertTable}><TableIcon className="h-4 w-4" /></Btn>
        <Btn title="Insert image" onClick={insertImage}><ImageIcon className="h-4 w-4" /></Btn>
        <Btn title="Insert link" onClick={insertLink}><Link2 className="h-4 w-4" /></Btn>
        <Btn title="Divider" onClick={() => insertHtml("<hr><p><br></p>")}><Minus className="h-4 w-4" /></Btn>
        <Sep />
        <Btn title="Clear formatting" onClick={() => cmd("removeFormat")}><RemoveFormatting className="h-4 w-4" /></Btn>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        spellCheck
        className="note-doc min-h-[60vh] px-5 py-6 sm:px-8 sm:py-8"
      />
    </div>
  );
}
