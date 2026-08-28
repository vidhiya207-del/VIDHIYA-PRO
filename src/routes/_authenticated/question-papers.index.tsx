import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateQuestionPaper } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { userMessage } from "@/lib/ai-error";
import { useAiRun } from "@/lib/ai-progress";

export const Route = createFileRoute("/_authenticated/question-papers/")({
  component: PapersHome,
});

type Row = { id: string; title: string; subject: string; unit: string | null; total_marks: number | null; created_at: string };

function PapersHome() {
  const nav = useNavigate();
  const call = useServerFn(generateQuestionPaper);
  const [rows, setRows] = useState<Row[]>([]);
  const { running: loading, status, run } = useAiRun();
  const [form, setForm] = useState({
    subject: "", unit: "", totalMarks: 100, difficulty: "mixed" as "easy"|"medium"|"hard"|"mixed",
    pattern: "", department: "", title: "",
  });

  const load = async () => {
    const { data } = await supabase.from("question_papers").select("id,title,subject,unit,total_marks,created_at").order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim()) return toast.error("Subject required");
    await run(async () => {
      try {
        const res = await call({ data: {
          subject: form.subject,
          unit: form.unit || undefined,
          totalMarks: form.totalMarks,
          difficulty: form.difficulty,
          pattern: form.pattern || undefined,
          department: form.department || undefined,
          title: form.title || undefined,
        }});
        toast.success("Question paper generated!");
        nav({ to: "/question-papers/$id", params: { id: res.id } });
      } catch (err) { toast.error(userMessage(err)); }
    });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("question_papers").delete().eq("id", id);
    load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">AI Question Paper Generator</h1>
        <p className="text-muted-foreground">Generate university-pattern papers by unit, difficulty and mark scheme.</p>
      </div>

      <form onSubmit={submit} className="glass rounded-2xl p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Subject"><Input value={form.subject} onChange={(e)=>setForm({...form,subject:e.target.value})} placeholder="Data Structures" /></Field>
        <Field label="Department"><Input value={form.department} onChange={(e)=>setForm({...form,department:e.target.value})} placeholder="CSE" /></Field>
        <Field label="Unit"><Input value={form.unit} onChange={(e)=>setForm({...form,unit:e.target.value})} placeholder="Unit 3" /></Field>
        <Field label="Title (optional)"><Input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="Model Exam I" /></Field>
        <Field label="Total marks"><Input type="number" min={10} max={200} value={form.totalMarks} onChange={(e)=>setForm({...form,totalMarks:Number(e.target.value)})} /></Field>
        <Field label="Difficulty">
          <select value={form.difficulty} onChange={(e)=>setForm({...form,difficulty:e.target.value as "easy"|"medium"|"hard"|"mixed"})} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="mixed">Mixed</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Pattern (optional)"><Input value={form.pattern} onChange={(e)=>setForm({...form,pattern:e.target.value})} placeholder="Part A 10x2, Part B 5x13, Part C 1x15" /></Field>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="w-full gradient-brand text-primary-foreground glow-ring" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{status}</> : <><Sparkles className="mr-2 h-4 w-4" />Generate Paper</>}
          </Button>
        </div>
      </form>

      <div>
        <h2 className="mb-3 font-semibold">Your papers</h2>
        {rows.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-muted-foreground">No papers yet.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <div key={r.id} className="glass rounded-2xl p-5">
                <Link to="/question-papers/$id" params={{ id: r.id }}>
                  <div className="text-xs uppercase tracking-widest text-primary">{r.subject}</div>
                  <div className="mt-1 text-lg font-semibold">{r.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{r.unit ?? "All units"} · {r.total_marks} marks · {new Date(r.created_at).toLocaleDateString()}</div>
                </Link>
                <button onClick={() => remove(r.id)} className="mt-3 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label><div className="mt-1">{children}</div></div>;
}
