import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatMathDeep } from "@/lib/math-format";
import { generateSlide } from "@/lib/ppt-ai.functions";
import { SlideView } from "@/components/SlideView";
import { TEMPLATES, getTemplate, detectMotif, MOTIF_LABEL, FONT_STACKS, type Motif } from "@/lib/ppt-themes";
import { DEFAULT_SETTINGS, newId, normalizeSlides, type DeckSettings, type Slide, type SlideLayout } from "@/lib/ppt-types";
import { exportImages, exportPdf, exportPptx } from "@/lib/ppt-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Copy, Download, FileImage, FileText,
  Loader2, Maximize2, Palette, Plus, Save, Sparkles, Trash2, ArrowUp, ArrowDown, Presentation,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ppt/$id")({
  component: PPTEditor,
});

const LAYOUTS: SlideLayout[] = ["title", "section", "bullets", "two-column", "table", "chart", "code", "quote", "process", "stats", "qa", "summary"];

type Deck = {
  id: string; subject: string; topic: string; template: string | null;
  slides: unknown; settings: unknown; created_at: string;
};

function PPTEditor() {
  const { id } = Route.useParams();
  const askAI = useServerFn(generateSlide);
  const stageRef = useRef<HTMLDivElement>(null);

  const [deck, setDeck] = useState<Deck | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [template, setTemplate] = useState("professional");
  const [settings, setSettings] = useState<DeckSettings>(DEFAULT_SETTINGS);
  const [i, setI] = useState(0);
  const [tab, setTab] = useState<"content" | "design">("content");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [present, setPresent] = useState(false);
  const [scale, setScale] = useState(0.6);
  const [aiPrompt, setAiPrompt] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ppts").select("*").eq("id", id).maybeSingle();
      if (!data) return;
      const d = data as unknown as Deck;
      setDeck(d);
      setSlides(formatMathDeep(normalizeSlides(d.slides)));
      setTemplate(d.template ?? "professional");
      setSettings({ ...DEFAULT_SETTINGS, ...((d.settings as DeckSettings) ?? {}) });
    })();
  }, [id]);

  // responsive scaling of the 1280x720 canvas
  useEffect(() => {
    const fit = () => {
      const w = wrapRef.current?.clientWidth ?? 900;
      setScale(present ? Math.min(window.innerWidth / 1280, window.innerHeight / 720) : Math.min(w / 1280, 1));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [present, tab]);

  const baseTemplate = getTemplate(template);
  const t = useMemo(() => ({
    ...baseTemplate,
    accent: settings.accent || baseTemplate.accent,
    accent2: settings.accent2 || baseTemplate.accent2,
    heading: settings.headingFont ? FONT_STACKS[settings.headingFont] ?? baseTemplate.heading : baseTemplate.heading,
    body: settings.bodyFont ? FONT_STACKS[settings.bodyFont] ?? baseTemplate.body : baseTemplate.body,
  }), [baseTemplate, settings]);

  const motif = (settings.motif as Motif) || detectMotif(deck?.subject, deck?.topic);

  const save = useCallback(async (next?: { slides?: Slide[]; template?: string; settings?: DeckSettings }, notify = false) => {
    setSaving(true);
    const { error } = await supabase.from("ppts").update({
      slides: (next?.slides ?? slides) as never,
      template: next?.template ?? template,
      settings: (next?.settings ?? settings) as never,
      updated_at: new Date().toISOString(),
    } as never).eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else if (notify) toast.success("Presentation saved");
  }, [id, slides, template, settings]);

  // autosave
  useEffect(() => {
    if (!deck) return;
    const h = setTimeout(() => { save(); }, 1500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, template, settings]);

  // keyboard nav in present mode
  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") setI((k) => Math.min(slides.length - 1, k + 1));
      if (e.key === "ArrowLeft") setI((k) => Math.max(0, k - 1));
      if (e.key === "Escape") setPresent(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present, slides.length]);

  if (!deck) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const s = slides[i];
  const patch = (p: Partial<Slide>) => setSlides((arr) => arr.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= slides.length) return;
    setSlides((arr) => { const c = [...arr]; const [x] = c.splice(from, 1); c.splice(to, 0, x!); return c; });
    setI(to);
  };
  const addSlide = () => {
    setSlides((arr) => { const c = [...arr]; c.splice(i + 1, 0, { id: newId(), layout: "bullets", title: "New slide", bullets: ["Point one", "Point two"] }); return c; });
    setI(i + 1);
  };
  const duplicate = () => {
    setSlides((arr) => { const c = [...arr]; c.splice(i + 1, 0, { ...arr[i]!, id: newId() }); return c; });
    setI(i + 1);
  };
  const removeSlide = () => {
    if (slides.length <= 1) return toast.error("A deck needs at least one slide");
    setSlides((arr) => arr.filter((_, k) => k !== i));
    setI(Math.max(0, i - 1));
  };

  const aiAdd = async () => {
    if (!aiPrompt.trim()) return toast.error("Describe the slide you want");
    setBusy("ai");
    try {
      const res = await askAI({ data: { subject: deck.subject, topic: deck.topic, instruction: aiPrompt, layout: s?.layout ?? "bullets" } });
      const slide = { ...(res.slide as Slide), id: newId() };
      setSlides((arr) => { const c = [...arr]; c.splice(i + 1, 0, slide); return c; });
      setI(i + 1); setAiPrompt("");
      toast.success("Slide added");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const runExport = async (kind: "pptx" | "pdf" | "png" | "jpeg") => {
    setBusy(kind);
    try {
      if (kind === "pptx") await exportPptx(deck.topic, slides, t, { animations: settings.animations });
      else if (!stageRef.current) throw new Error("Export stage unavailable");
      else if (kind === "pdf") await exportPdf(deck.topic, stageRef.current);
      else await exportImages(deck.topic, stageRef.current, kind);
      toast.success(`Exported as ${kind.toUpperCase()}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const canvas = s && (
    <div style={{ width: 1280 * scale, height: 720 * scale }} className="relative">
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }} className="absolute left-0 top-0">
        <SlideView slide={s} t={t} motif={motif} index={i} total={slides.length}
          animation={settings.animation} animations={settings.animations} deckTitle={deck.topic} />
      </div>
    </div>
  );

  if (present) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" onClick={() => setI(Math.min(slides.length - 1, i + 1))}>
        {canvas}
        <button onClick={(e) => { e.stopPropagation(); setPresent(false); }} className="absolute right-5 top-5 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white">Esc</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/ppt" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All presentations
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{saving ? "Saving…" : "All changes saved"}</span>
          <Button size="sm" variant="outline" onClick={() => setPresent(true)}><Maximize2 className="mr-1.5 h-4 w-4" />Present</Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runExport("pptx")}>
            {busy === "pptx" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Presentation className="mr-1.5 h-4 w-4" />}PPTX
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runExport("pdf")}>
            {busy === "pdf" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}PDF
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runExport("png")}>
            {busy === "png" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileImage className="mr-1.5 h-4 w-4" />}PNG
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runExport("jpeg")}>
            {busy === "jpeg" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}JPEG
          </Button>
          <Button size="sm" onClick={() => save(undefined, true)} className="gradient-brand text-primary-foreground"><Save className="mr-1.5 h-4 w-4" />Save edits</Button>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-primary">{deck.subject}</div>
        <h1 className="text-2xl font-bold">{deck.topic}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Select a slide to edit its text, data, notes, and layout. Save changes, then download an editable PPTX.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[170px_1fr_340px]">
        {/* Slide rail */}
        <div className="order-2 flex gap-2 overflow-x-auto lg:order-1 lg:max-h-[70vh] lg:flex-col lg:overflow-y-auto">
          {slides.map((sl, k) => (
            <button key={sl.id} onClick={() => setI(k)}
              className={`min-w-[140px] rounded-lg border p-2 text-left transition ${k === i ? "border-primary glow-ring" : "border-border hover:border-primary/50"}`}
              style={{ background: baseTemplate.bg }}>
              <div className="text-[10px]" style={{ color: t.muted }}>#{k + 1} · {sl.layout}</div>
              <div className="mt-1 line-clamp-2 text-[11px] font-medium" style={{ color: t.text }}>{sl.title ?? "Untitled"}</div>
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="order-1 space-y-3 lg:order-2" ref={wrapRef}>
          <div className="glass overflow-hidden rounded-2xl p-2">{canvas}</div>
          <div className="flex items-center justify-between">
            <Button size="sm" variant="outline" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}><ChevronLeft className="h-4 w-4" /> Prev</Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={addSlide}><Plus className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={duplicate}><Copy className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => move(i, i - 1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => move(i, i + 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={removeSlide}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => setI(Math.min(slides.length - 1, i + 1))} disabled={i >= slides.length - 1}>Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Inspector */}
        <div className="order-3 space-y-4">
          <div className="flex rounded-lg border border-border p-1 text-sm">
            {(["content", "design"] as const).map((x) => (
              <button key={x} onClick={() => setTab(x)}
                className={`flex-1 rounded-md px-3 py-1.5 capitalize ${tab === x ? "gradient-brand text-primary-foreground" : "text-muted-foreground"}`}>{x}</button>
            ))}
          </div>

          {tab === "content" && s ? (
            <div className="glass space-y-3 rounded-2xl p-4">
              <div>
                <Label>Layout</Label>
                <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={s.layout} onChange={(e) => patch({ layout: e.target.value as SlideLayout })}>
                  {LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div><Label>Title</Label><Input className="mt-1" value={s.title ?? ""} onChange={(e) => patch({ title: e.target.value })} /></div>
              <div><Label>Subtitle / kicker</Label><Input className="mt-1" value={s.subtitle ?? ""} onChange={(e) => patch({ subtitle: e.target.value })} /></div>
              <div><Label>Body</Label><Textarea className="mt-1" rows={2} value={s.body ?? ""} onChange={(e) => patch({ body: e.target.value })} /></div>
              <div>
                <Label>Bullets (one per line)</Label>
                <Textarea className="mt-1" rows={5} value={(s.bullets ?? []).join("\n")} onChange={(e) => patch({ bullets: e.target.value.split("\n") })} />
              </div>

              {s.layout === "two-column" && ([["left", s.left] as const, ["right", s.right] as const]).map(([side, col]) => (
                <div key={side} className="rounded-lg border border-border p-3">
                  <Label className="capitalize">{side} column</Label>
                  <Input className="mt-1" placeholder="Heading" value={col?.heading ?? ""}
                    onChange={(e) => patch({ [side]: { ...col, heading: e.target.value } } as Partial<Slide>)} />
                  <Textarea className="mt-2" rows={4} placeholder="One bullet per line" value={(col?.bullets ?? []).join("\n")}
                    onChange={(e) => patch({ [side]: { ...col, bullets: e.target.value.split("\n") } } as Partial<Slide>)} />
                </div>
              ))}

              {s.layout === "table" && (
                <div className="rounded-lg border border-border p-3">
                  <Label>Table (CSV — first row = headers)</Label>
                  <Textarea className="mt-1 font-mono text-xs" rows={6}
                    value={[s.table?.headers ?? [], ...(s.table?.rows ?? [])].map((r) => r.join(", ")).join("\n")}
                    onChange={(e) => {
                      const rows = e.target.value.split("\n").map((r) => r.split(",").map((c) => c.trim()));
                      patch({ table: { headers: rows[0] ?? [], rows: rows.slice(1) } });
                    }} />
                </div>
              )}

              {s.layout === "chart" && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <Label>Chart</Label>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={s.chart?.type ?? "bar"}
                    onChange={(e) => patch({ chart: { type: e.target.value as "bar" | "line" | "pie", labels: s.chart?.labels ?? [], values: s.chart?.values ?? [] } })}>
                    <option value="bar">Bar</option><option value="line">Line</option><option value="pie">Pie</option>
                  </select>
                  <Input placeholder="Labels (comma separated)" value={(s.chart?.labels ?? []).join(", ")}
                    onChange={(e) => patch({ chart: { type: s.chart?.type ?? "bar", labels: e.target.value.split(",").map((x) => x.trim()), values: s.chart?.values ?? [] } })} />
                  <Input placeholder="Values (comma separated)" value={(s.chart?.values ?? []).join(", ")}
                    onChange={(e) => patch({ chart: { type: s.chart?.type ?? "bar", labels: s.chart?.labels ?? [], values: e.target.value.split(",").map((x) => Number(x.trim()) || 0) } })} />
                </div>
              )}

              {s.layout === "process" && (
                <div><Label>Steps (one per line)</Label>
                  <Textarea className="mt-1" rows={4} value={(s.steps ?? []).join("\n")} onChange={(e) => patch({ steps: e.target.value.split("\n") })} /></div>
              )}

              {s.layout === "stats" && (
                <div><Label>Stats (value | label per line)</Label>
                  <Textarea className="mt-1" rows={3} value={(s.stats ?? []).map((x) => `${x.value} | ${x.label}`).join("\n")}
                    onChange={(e) => patch({ stats: e.target.value.split("\n").map((l) => { const [v, ...r] = l.split("|"); return { value: (v ?? "").trim(), label: r.join("|").trim() }; }) })} /></div>
              )}

              {s.layout === "qa" && (
                <div><Label>Q&amp;A (question | answer per line)</Label>
                  <Textarea className="mt-1" rows={5} value={(s.qa ?? []).map((x) => `${x.q} | ${x.a}`).join("\n")}
                    onChange={(e) => patch({ qa: e.target.value.split("\n").map((l) => { const [q, ...r] = l.split("|"); return { q: (q ?? "").trim(), a: r.join("|").trim() }; }) })} /></div>
              )}

              {s.layout === "code" && (
                <>
                  <div><Label>Language</Label><Input className="mt-1" value={s.language ?? ""} onChange={(e) => patch({ language: e.target.value })} /></div>
                  <div><Label>Code</Label><Textarea className="mt-1 font-mono text-xs" rows={8} value={s.code ?? ""} onChange={(e) => patch({ code: e.target.value })} /></div>
                </>
              )}

              {s.layout === "quote" && (
                <>
                  <div><Label>Quote</Label><Textarea className="mt-1" rows={3} value={s.quote ?? ""} onChange={(e) => patch({ quote: e.target.value })} /></div>
                  <div><Label>Author</Label><Input className="mt-1" value={s.author ?? ""} onChange={(e) => patch({ author: e.target.value })} /></div>
                </>
              )}

              <div><Label>Speaker notes</Label><Textarea className="mt-1" rows={3} value={s.notes ?? ""} onChange={(e) => patch({ notes: e.target.value })} /></div>

              <div className="rounded-lg border border-dashed border-border p-3">
                <Label className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" />Add a slide with AI</Label>
                <Textarea className="mt-1" rows={2} placeholder="e.g. Case study on Linux CFS scheduler with data table"
                  value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
                <Button size="sm" className="mt-2 w-full gradient-brand text-primary-foreground" disabled={busy === "ai"} onClick={aiAdd}>
                  {busy === "ai" ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Designing…</> : "Generate slide"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="glass space-y-4 rounded-2xl p-4">
              <div>
                <Label className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" />Template</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {TEMPLATES.map((tp) => (
                    <button key={tp.id} onClick={() => setTemplate(tp.id)}
                      className={`overflow-hidden rounded-lg border text-left ${template === tp.id ? "border-primary glow-ring" : "border-border"}`}>
                      <div className="h-8 w-full" style={{ background: tp.bg }} />
                      <div className="px-1.5 py-1 text-[10px]">{tp.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Accent</Label>
                  <Input type="color" className="mt-1 h-9 p-1" value={settings.accent || toHex(baseTemplate.accent)}
                    onChange={(e) => setSettings({ ...settings, accent: e.target.value })} />
                </div>
                <div>
                  <Label>Secondary</Label>
                  <Input type="color" className="mt-1 h-9 p-1" value={settings.accent2 || toHex(baseTemplate.accent2)}
                    onChange={(e) => setSettings({ ...settings, accent2: e.target.value })} />
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={() => setSettings({ ...settings, accent: undefined, accent2: undefined })}>Reset colors to template</Button>

              <div className="grid grid-cols-2 gap-3">
                {(["headingFont", "bodyFont"] as const).map((k) => (
                  <div key={k}>
                    <Label>{k === "headingFont" ? "Heading font" : "Body font"}</Label>
                    <select className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                      value={settings[k] ?? ""} onChange={(e) => setSettings({ ...settings, [k]: e.target.value || undefined })}>
                      <option value="">Template default</option>
                      {Object.keys(FONT_STACKS).map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <Label>Background theme</Label>
                <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={settings.motif ?? ""} onChange={(e) => setSettings({ ...settings, motif: e.target.value || undefined })}>
                  <option value="">Auto ({MOTIF_LABEL[detectMotif(deck.subject, deck.topic)]})</option>
                  {Object.entries(MOTIF_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div>
                <Label>Animation</Label>
                <div className="mt-1 flex items-center gap-2">
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={settings.animation}
                    onChange={(e) => setSettings({ ...settings, animation: e.target.value as DeckSettings["animation"] })}>
                    <option value="fade">Fade</option><option value="zoom">Zoom</option><option value="slide">Slide</option>
                    <option value="morph">Morph</option><option value="appear">Appear</option>
                  </select>
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.animations} onChange={(e) => setSettings({ ...settings, animations: e.target.checked })} />
                  Enable animations
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden full-size stage used for PDF / PNG / JPEG export */}
      <div ref={stageRef} className="ppt-export-stage" aria-hidden="true">
        {slides.map((sl, k) => (
          <div key={sl.id} data-export-slide>
            <SlideView slide={sl} t={t} motif={motif} index={k} total={slides.length} animations={false} deckTitle={deck.topic} />
          </div>
        ))}
      </div>
    </div>
  );
}

function toHex(c: string) {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "#2f4bd8";
}
