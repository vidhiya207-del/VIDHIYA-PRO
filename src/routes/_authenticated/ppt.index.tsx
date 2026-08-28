import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generatePresentation } from "@/lib/ppt-ai.functions";
import { extractFromFile, type ExtractedSource } from "@/lib/extract-text";
import { TEMPLATES, getTemplate, detectMotif, MOTIF_LABEL } from "@/lib/ppt-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Trash2, Upload, X, FileText, Presentation } from "lucide-react";
import { toast } from "sonner";
import { userMessage } from "@/lib/ai-error";
import { useAiRun } from "@/lib/ai-progress";

export const Route = createFileRoute("/_authenticated/ppt/")({
  head: () => ({
    meta: [
      { title: "AI PowerPoint Generator | StaffMate AI" },
      { name: "description", content: "Turn a topic or your PDF/DOCX/PPT references into a professional, editable presentation with AI templates, backgrounds and PPTX export." },
      { property: "og:title", content: "AI PowerPoint Generator | StaffMate AI" },
      { property: "og:description", content: "Generate presentation decks from topics or uploaded references in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PPTHome,
});

type PPT = { id: string; subject: string; topic: string; template: string | null; created_at: string };

const AUDIENCES = ["College / Engineering", "UGC NET", "GATE", "MCA", "School", "Business", "Startup Pitch", "Research / Conference", "Technical Interview", "Medical"];

function PPTHome() {
  const nav = useNavigate();
  const call = useServerFn(generatePresentation);
  const fileRef = useRef<HTMLInputElement>(null);

  const [list, setList] = useState<PPT[]>([]);
  const { running: loading, status, run } = useAiRun();
  const [extracting, setExtracting] = useState(false);
  const [sources, setSources] = useState<ExtractedSource[]>([]);
  const [form, setForm] = useState({
    subject: "", topic: "", slideCount: 14, audience: AUDIENCES[0]!,
    language: "english" as "english" | "tamil" | "bilingual",
    depth: "standard" as "overview" | "standard" | "detailed",
    template: "professional",
  });

  const load = async () => {
    const { data } = await supabase.from("ppts").select("id,subject,topic,template,created_at").order("created_at", { ascending: false });
    setList((data ?? []) as PPT[]);
  };
  useEffect(() => { load(); }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setExtracting(true);
    for (const f of Array.from(files).slice(0, 6)) {
      try { const ex = await extractFromFile(f); setSources((s) => [...s, ex]); }
      catch (e) { toast.error((e as Error).message); }
    }
    setExtracting(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.topic.trim()) return toast.error("Subject and topic are required");
    await run(async () => {
      try {
        const sourceText = sources.map((s) => `\n\n### FILE: ${s.name} (${s.kind})\n${s.text}`).join("").slice(0, 110000);
        const images = sources.flatMap((s) => s.images).slice(0, 6);
        const res = await call({
          data: {
            ...form,
            sourceText: sourceText || undefined,
            images: images.length ? images : undefined,
            sources: sources.map((s) => ({ name: s.name, kind: s.kind })),
          },
        });
        toast.success("Presentation ready!");
        nav({ to: "/ppt/$id", params: { id: res.id } });
      } catch (err) { toast.error(userMessage(err)); }
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this presentation?")) return;
    await supabase.from("ppts").delete().eq("id", id);
    load();
  };

  const motif = detectMotif(form.subject, form.topic);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">AI PowerPoint Generator</h1>
        <p className="text-muted-foreground">Topic or references in — a designed, editable, exportable deck out.</p>
      </div>

      <form onSubmit={submit} className="glass space-y-6 rounded-2xl p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Subject</Label>
            <Input className="mt-1" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Operating Systems" />
          </div>
          <div>
            <Label>Topic</Label>
            <Input className="mt-1" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Process Scheduling Algorithms" />
          </div>
        </div>

        {/* Reference uploads */}
        <div>
          <Label>Reference files (optional)</Label>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
            className="mt-1 cursor-pointer rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
          >
            {extracting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Reading files…</span>
              : <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" />Drop or click — PDF, DOCX, PPTX, TXT, images (scanned notes are read visually)</span>}
          </div>
          <input ref={fileRef} type="file" multiple hidden accept=".pdf,.docx,.pptx,.txt,.md,image/*" onChange={(e) => onFiles(e.target.files)} />
          {sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {sources.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5 text-primary" />{s.name}
                  <span className="text-muted-foreground">{s.chars ? `${Math.round(s.chars / 1000)}k chars` : `${s.images.length} image(s)`}</span>
                  <button type="button" onClick={() => setSources((x) => x.filter((_, k) => k !== i))}><X className="h-3.5 w-3.5 hover:text-destructive" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <Label>Audience</Label>
            <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              {AUDIENCES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <Label>Slides</Label>
            <Input type="number" min={6} max={30} className="mt-1" value={form.slideCount} onChange={(e) => setForm({ ...form, slideCount: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Language</Label>
            <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as typeof form.language })}>
              <option value="english">English</option>
              <option value="tamil">Tamil</option>
              <option value="bilingual">Tamil + English</option>
            </select>
          </div>
          <div>
            <Label>Depth</Label>
            <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.depth} onChange={(e) => setForm({ ...form, depth: e.target.value as typeof form.depth })}>
              <option value="overview">Overview</option>
              <option value="standard">Standard</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Template</Label>
            <span className="text-xs text-muted-foreground">Auto background: {MOTIF_LABEL[motif]}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => setForm({ ...form, template: t.id })}
                className={`overflow-hidden rounded-xl border text-left transition ${form.template === t.id ? "border-primary glow-ring" : "border-border hover:border-primary/50"}`}>
                <div className="h-12 w-full" style={{ background: t.bg }}>
                  <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})` }} />
                </div>
                <div className="px-2 py-1.5 text-[11px] font-medium">{t.name}</div>
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full gradient-brand text-primary-foreground glow-ring" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{status}</> : <><Sparkles className="mr-2 h-4 w-4" />Generate Presentation</>}
        </Button>
      </form>

      <div>
        <h2 className="mb-3 font-semibold">Your presentations</h2>
        {list.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-muted-foreground">No presentations yet.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => {
              const t = getTemplate(p.template);
              return (
                <div key={p.id} className="glass overflow-hidden rounded-2xl">
                  <Link to="/ppt/$id" params={{ id: p.id }}>
                    <div className="flex h-24 items-end p-3" style={{ background: t.bg }}>
                      <Presentation className="h-5 w-5" style={{ color: t.accent }} />
                    </div>
                    <div className="p-5">
                      <div className="text-xs uppercase tracking-widest text-primary">{p.subject}</div>
                      <div className="mt-1 line-clamp-2 text-lg font-semibold">{p.topic}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{t.name} · {new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                  </Link>
                  <button onClick={() => remove(p.id)} className="px-5 pb-4 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
