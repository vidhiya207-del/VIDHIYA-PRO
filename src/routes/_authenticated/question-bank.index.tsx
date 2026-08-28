import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateQuestionBank } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { userMessage } from "@/lib/ai-error";
import { useAiRun } from "@/lib/ai-progress";

export const Route = createFileRoute("/_authenticated/question-bank/")({
  component: BankHome,
});

type Row = { id: string; subject: string; topic: string; created_at: string };

function BankHome() {
  const nav = useNavigate();
  const call = useServerFn(generateQuestionBank);
  const [rows, setRows] = useState<Row[]>([]);
  const { running: loading, status, run } = useAiRun();
  const [form, setForm] = useState({ subject: "", topic: "" });

  const load = async () => {
    const { data } = await supabase.from("question_bank").select("id,subject,topic,created_at").order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.topic.trim()) return toast.error("Subject and topic required");
    await run(async () => {
      try {
        const res = await call({ data: form });
        toast.success("Question bank generated!");
        nav({ to: "/question-bank/$id", params: { id: res.id } });
      } catch (err) { toast.error(userMessage(err)); }
    });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("question_bank").delete().eq("id", id);
    load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">AI Question Bank</h1>
        <p className="text-muted-foreground">Instantly generate MCQs, short, long, programming and interview questions.</p>
      </div>

      <form onSubmit={submit} className="glass rounded-2xl p-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div><Label>Subject</Label><Input className="mt-1" value={form.subject} onChange={(e)=>setForm({...form,subject:e.target.value})} placeholder="C Programming" /></div>
        <div><Label>Topic</Label><Input className="mt-1" value={form.topic} onChange={(e)=>setForm({...form,topic:e.target.value})} placeholder="Arrays" /></div>
        <div className="flex items-end">
          <Button type="submit" className="w-full gradient-brand text-primary-foreground glow-ring" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>{status}</> : <><Sparkles className="mr-2 h-4 w-4"/>Generate Bank</>}
          </Button>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">No question banks yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-5">
              <Link to="/question-bank/$id" params={{ id: r.id }}>
                <div className="text-xs uppercase tracking-widest text-primary">{r.subject}</div>
                <div className="mt-1 text-lg font-semibold">{r.topic}</div>
                <div className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
              </Link>
              <button onClick={() => remove(r.id)} className="mt-3 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4"/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
