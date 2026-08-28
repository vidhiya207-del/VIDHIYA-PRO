import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateRichNotes } from "@/lib/notes-ai.functions";
import { extractFromFile, type ExtractedSource } from "@/lib/extract-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Sparkles, UploadCloud, FileText, FileImage, Presentation, File as FileIcon, X, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { userMessage } from "@/lib/ai-error";
import { useAiRun } from "@/lib/ai-progress";

export const Route = createFileRoute("/_authenticated/notes/new")({
  head: () => ({
    meta: [
      { title: "Generate AI Notes from your material — StaffMate AI" },
      { name: "description", content: "Upload PDF, DOCX, PPTX, TXT, images or scanned handwritten notes and generate structured, syllabus-oriented college notes." },
      { property: "og:title", content: "Generate AI Notes from your material — StaffMate AI" },
      { property: "og:description", content: "Turn your uploaded reference material into exam-ready, editable college notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewNote,
});

const DEPARTMENTS = [
  "Computer Science", "Information Technology", "Mechanical", "Civil", "ECE", "EEE",
  "BBA", "MBA", "Arts", "Science", "Commerce", "Other",
];

const STYLES = [
  { id: "short", label: "Short Notes", hint: "Compact essentials" },
  { id: "detailed", label: "Detailed Notes", hint: "Full explanation" },
  { id: "exam", label: "Exam Preparation", hint: "2/5/10 mark ready" },
  { id: "revision", label: "Revision Notes", hint: "Last-minute recap" },
  { id: "classroom", label: "Classroom Notes", hint: "Teaching flow" },
] as const;

type StyleId = (typeof STYLES)[number]["id"];

type Loaded = ExtractedSource & { status: "ok" };

function iconFor(kind: string) {
  if (kind === "image") return FileImage;
  if (kind === "pptx") return Presentation;
  if (kind === "pdf" || kind === "docx" || kind === "txt") return FileText;
  return FileIcon;
}

function NewNote() {
  const nav = useNavigate();
  const call = useServerFn(generateRichNotes);
  const fileRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<Loaded[]>([]);
  const [parsing, setParsing] = useState(false);
  const { running: loading, status, run } = useAiRun();
  const [drag, setDrag] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    topic: "",
    department: "Computer Science",
    style: "detailed" as StyleId,
    language: "en" as "en" | "ta" | "bi",
    instructions: "",
  });

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setParsing(true);
    const next: Loaded[] = [];
    for (const file of Array.from(list).slice(0, 8)) {
      try {
        const res = await extractFromFile(file);
        next.push({ ...res, status: "ok" });
      } catch (err) {
        toast.error(userMessage(err));
      }
    }
    setFiles((f) => [...f, ...next].slice(0, 8));
    setParsing(false);
    if (next.length) {
      toast.success(`${next.length} file${next.length === 1 ? "" : "s"} analysed`);
      if (!form.topic && next[0]) {
        setForm((f) => ({ ...f, topic: f.topic || next[0]!.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") }));
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.topic.trim()) return toast.error("Subject and topic are required");
    await run(async () => {
      try {
        const res = await call({
          data: {
            subject: form.subject.trim(),
            topic: form.topic.trim(),
            department: form.department,
            style: form.style,
            language: form.language,
            instructions: form.instructions.trim() || undefined,
            sources: files.map((f) => ({ name: f.name, kind: f.kind, text: f.text, images: f.images })),
          },
        });
        toast.success("Notes generated!");
        nav({ to: "/notes/$id", params: { id: res.id } });
      } catch (err) {
        toast.error(userMessage(err));
      }
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Generate AI Notes</h1>
        <p className="mt-1 text-muted-foreground">
          Upload your syllabus material — PDF, Word, PowerPoint, text, images or scanned handwritten notes. The AI reads
          every file and writes structured notes with headings, tables, diagrams and highlights.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Upload */}
        <div className="glass rounded-2xl p-6">
          <Label className="text-sm font-semibold">Reference material (optional but recommended)</Label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
              drag ? "border-primary bg-accent/40" : "border-border hover:border-primary/60"
            }`}
          >
            <UploadCloud className="mx-auto h-8 w-8 text-primary" />
            <div className="mt-2 font-medium">Drop files here or click to browse</div>
            <div className="mt-1 text-xs text-muted-foreground">
              PDF · DOCX · PPTX · TXT · PNG/JPG · scanned &amp; handwritten notes · up to 8 files
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept=".pdf,.docx,.pptx,.txt,.md,image/*"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
            />
          </div>

          {parsing && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading and extracting your files…
            </div>
          )}

          {files.length > 0 && (
            <ul className="mt-4 space-y-2">
              {files.map((f, i) => {
                const Icon = iconFor(f.kind);
                return (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm">
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {f.kind === "image" || f.images.length
                        ? `${f.images.length} image${f.images.length === 1 ? "" : "s"} for vision`
                        : `${Math.round(f.text.length / 1000)}k chars`}
                    </span>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <button type="button" onClick={() => setFiles((list) => list.filter((_, idx) => idx !== i))} className="shrink-0 text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Details */}
        <div className="glass grid grid-cols-1 gap-4 rounded-2xl p-6 sm:grid-cols-2">
          <div>
            <Label>Department</Label>
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <Label>Language</Label>
            <select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value as "en" | "ta" | "bi" })}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="ta">Tamil (தமிழ்)</option>
              <option value="bi">Bilingual — English + Tamil</option>
            </select>
          </div>
          <div>
            <Label>Subject</Label>
            <Input className="mt-1" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Data Structures" />
          </div>
          <div>
            <Label>Topic / Unit</Label>
            <Input className="mt-1" maxLength={2000} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Unit I — Arrays & Linked Lists" />
          </div>
          <div className="sm:col-span-2">
            <Label>Extra instructions (optional)</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="e.g. Follow Anna University syllabus, add more C programs, include comparison tables"
            />
          </div>
        </div>

        {/* Style */}
        <div className="glass rounded-2xl p-6">
          <Label className="text-sm font-semibold">Note type</Label>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setForm({ ...form, style: s.id })}
                className={`rounded-xl border p-3 text-left transition ${
                  form.style === s.id ? "border-primary bg-accent/50 glow-ring" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="text-sm font-semibold">{s.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full gradient-brand text-primary-foreground glow-ring" disabled={loading || parsing}>
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{status}</>
          ) : (
            <><Sparkles className="mr-2 h-4 w-4" />Generate Notes</>
          )}
        </Button>
        {loading && <p className="text-center text-xs text-muted-foreground">Detailed notes can take up to 3 minutes. Please stay on this page.</p>}
      </form>
    </div>
  );
}
