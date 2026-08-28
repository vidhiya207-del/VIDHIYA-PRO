import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RichTextEditor } from "@/components/RichTextEditor";
import { formatMathHtml } from "@/lib/math-format";
import { repairTruncatedHtml } from "@/lib/html-repair";
import { exportDocx, exportHtml, exportPdf, exportTxt } from "@/lib/note-export";
import { ArrowLeft, Check, Cloud, Eye, FileCode2, FileDown, FileText, Loader2, Pencil, Printer, Star } from "lucide-react";
import { toast } from "sonner";
import { userMessage } from "@/lib/ai-error";

export const Route = createFileRoute("/_authenticated/notes/$id")({
  head: () => ({
    meta: [
      { title: "Note editor — StaffMate AI" },
      { name: "description", content: "Edit your AI-generated college notes and export them as PDF, DOCX, TXT or HTML with formatting preserved." },
      { property: "og:title", content: "Note editor — StaffMate AI" },
      { property: "og:description", content: "Edit, format and export your AI-generated college notes." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NoteView,
});

type LegacyContent = Record<string, unknown>;
type Note = {
  id: string;
  subject: string;
  topic: string;
  title: string | null;
  department: string | null;
  is_favorite: boolean;
  body_html: string | null;
  style: string;
  language: string;
  content: LegacyContent | null;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** Convert notes created before the rich editor into editable HTML. */
function legacyToHtml(note: Note): string {
  const c = (note.content ?? {}) as Record<string, never>;
  const section = (title: string, body: string) => (body ? `<h2>${title}</h2>${body}` : "");
  const para = (v: unknown) => (v ? `<p>${esc(v).replace(/\n/g, "<br>")}</p>` : "");
  const list = (v: unknown) =>
    Array.isArray(v) && v.length ? `<ul>${v.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";

  const programs = Array.isArray(c["programs"])
    ? (c["programs"] as Record<string, unknown>[])
        .map(
          (p) =>
            `<h3>${esc(p["title"])} <em>(${esc(p["language"])})</em></h3><pre><code>${esc(p["code"])}</code></pre>${para(p["line_by_line"])}${p["output"] ? `<div class="callout"><strong>Output:</strong><pre><code>${esc(p["output"])}</code></pre></div>` : ""}`,
        )
        .join("")
    : "";

  const mcqs = Array.isArray(c["mcqs"])
    ? (c["mcqs"] as Record<string, unknown>[])
        .map(
          (m, i) =>
            `<p><strong>${i + 1}. ${esc(m["question"])}</strong></p>${list(m["options"])}<p><mark>Answer: ${esc(m["answer"])}</mark> — ${esc(m["explanation"])}</p>`,
        )
        .join("")
    : "";

  return [
    `<h1>${esc(note.title || note.topic)}</h1>`,
    para(c["introduction"]),
    section("Definition", c["definition"] ? `<div class="callout">${para(c["definition"])}</div>` : ""),
    section("Simple Explanation", para(c["simple_explanation"])),
    section("Detailed Explanation", para(c["detailed_explanation"])),
    section("Real-World Example", para(c["real_world_example"])),
    section("Diagram", para(c["diagram_description"])),
    section("Flowchart", Array.isArray(c["flowchart_steps"]) ? `<ol>${(c["flowchart_steps"] as string[]).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""),
    section("Syntax", c["syntax"] ? `<pre><code>${esc(c["syntax"])}</code></pre>` : ""),
    section("Programs", programs),
    section("Advantages", list(c["advantages"])),
    section("Disadvantages", list(c["disadvantages"])),
    section("Applications", list(c["applications"])),
    section("Important Questions", list(c["important_questions"])),
    section("MCQs", mcqs),
    section("Short Questions", list(c["short_questions"])),
    section("Long Questions", list(c["long_questions"])),
    section("Key Points", list(c["key_points"])),
    section("Summary", para(c["summary"])),
  ]
    .filter(Boolean)
    .join("\n");
}

function NoteView() {
  const { id } = Route.useParams();
  const [note, setNote] = useState<Note | null>(null);
  const [html, setHtml] = useState("");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("notes").select("*").eq("id", id).maybeSingle();
      if (error || !data) return toast.error(error?.message ?? "Note not found");
      const n = data as unknown as Note;
      setNote(n);
      setTitle(n.title || n.topic);
      setHtml(formatMathHtml(repairTruncatedHtml(n.body_html && n.body_html.trim() ? n.body_html : legacyToHtml(n))));
    })();
  }, [id]);

  const save = useCallback(
    async (nextHtml: string, nextTitle: string) => {
      setSaving("saving");
      const { error } = await supabase
        .from("notes")
        .update({ body_html: nextHtml, title: nextTitle })
        .eq("id", id);
      if (error) {
        setSaving("idle");
        toast.error(error.message);
        return;
      }
      dirty.current = false;
      setSaving("saved");
      setTimeout(() => setSaving((s) => (s === "saved" ? "idle" : s)), 1800);
    },
    [id],
  );

  const queueSave = useCallback(
    (nextHtml: string, nextTitle: string) => {
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save(nextHtml, nextTitle), 1200);
    },
    [save],
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!note) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading note…
      </div>
    );
  }

  const toggleFav = async () => {
    await supabase.from("notes").update({ is_favorite: !note.is_favorite }).eq("id", id);
    setNote({ ...note, is_favorite: !note.is_favorite });
  };

  const guard = (fn: () => void) => () => {
    try { fn(); } catch (err) { toast.error(userMessage(err)); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link to="/notes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All notes
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {saving === "saving" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>}
          {saving === "saved" && <><Check className="h-3.5 w-3.5 text-primary" /> Saved</>}
          {saving === "idle" && <><Cloud className="h-3.5 w-3.5" /> Auto-save on</>}
        </div>
      </div>

      <div className="no-print glass rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-widest text-primary">
              {note.subject} · {note.department ?? "General"} · {note.style}
            </div>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); queueSave(html, e.target.value); }}
              className="mt-1 w-full bg-transparent text-2xl font-bold outline-none"
              placeholder="Note title"
            />
          </div>
          <button onClick={toggleFav} className="text-muted-foreground hover:text-primary" aria-label="Favourite">
            <Star className={`h-5 w-5 ${note.is_favorite ? "fill-primary text-primary" : ""}`} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="mr-2 inline-flex rounded-lg border border-border p-0.5">
            <button
              onClick={() => setMode("edit")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${mode === "edit" ? "gradient-brand text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => setMode("preview")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${mode === "preview" ? "gradient-brand text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
          </div>

          <button onClick={guard(() => exportPdf(title, html))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent">
            <Printer className="h-3.5 w-3.5" /> PDF
          </button>
          <button onClick={guard(() => exportDocx(title, html))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent">
            <FileDown className="h-3.5 w-3.5" /> Word
          </button>
          <button onClick={guard(() => exportTxt(title, html))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent">
            <FileText className="h-3.5 w-3.5" /> TXT
          </button>
          <button onClick={guard(() => exportHtml(title, html))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent">
            <FileCode2 className="h-3.5 w-3.5" /> HTML
          </button>
          <button
            onClick={() => save(html, title)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg gradient-brand px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            <Check className="h-3.5 w-3.5" /> Save now
          </button>
        </div>
      </div>

      {mode === "edit" ? (
        <RichTextEditor value={html} onChange={(next) => { setHtml(next); queueSave(next, title); }} />
      ) : (
        <div className="print-area rounded-2xl border border-border bg-card px-5 py-6 sm:px-10 sm:py-10">
          <div className="note-doc" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </div>
  );
}
