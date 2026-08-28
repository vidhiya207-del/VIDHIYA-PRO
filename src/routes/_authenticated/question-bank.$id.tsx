import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatMathDeep } from "@/lib/math-format";
import { ArrowLeft, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/question-bank/$id")({
  component: BankView,
});

type MCQ = { question: string; options: string[]; answer: string; explanation: string; difficulty?: string };
type QA = { question: string; answer: string };
type Prog = { question: string; sample_code: string; explanation: string };
type Content = { mcqs?: MCQ[]; short?: QA[]; long?: QA[]; programming?: Prog[]; interview?: QA[] };
type Row = { id: string; subject: string; topic: string; content: Content };

function BankView() {
  const { id } = Route.useParams();
  const [row, setRow] = useState<Row | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("question_bank").select("*").eq("id", id).maybeSingle();
      setRow(data ? formatMathDeep(data as Row) : null);
    })();
  }, [id]);
  if (!row) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const c = row.content;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex justify-between">
        <Link to="/question-bank" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/>All banks</Link>
        <button onClick={() => window.print()} className="rounded-md gradient-brand px-3 py-2 text-sm font-medium text-primary-foreground inline-flex items-center gap-2"><Printer className="h-4 w-4"/>Print</button>
      </div>
      <div className="glass rounded-2xl p-6">
        <div className="text-xs uppercase tracking-widest text-primary">{row.subject}</div>
        <h1 className="mt-1 text-3xl font-bold">{row.topic}</h1>
      </div>

      {c.mcqs?.length ? (
        <section className="glass rounded-2xl p-6">
          <h2 className="mb-3 text-xl font-semibold">MCQs ({c.mcqs.length})</h2>
          <ol className="space-y-4">
            {c.mcqs.map((m, i) => (
              <li key={i} className="rounded-lg bg-secondary/30 p-4">
                <div className="font-medium">{i+1}. {m.question}</div>
                <ul className="mt-2 space-y-1 text-sm">
                  {m.options.map((o,j)=><li key={j} className={o===m.answer?"text-primary font-medium":"text-muted-foreground"}>• {o}</li>)}
                </ul>
                <div className="mt-2 text-xs text-muted-foreground"><b>Answer:</b> {m.answer} — {m.explanation}</div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {(["short","long","interview"] as const).map((key) => {
        const arr = c[key];
        if (!arr?.length) return null;
        const title = key === "short" ? "Short Questions" : key === "long" ? "Long Questions" : "Interview Questions";
        return (
          <section key={key} className="glass rounded-2xl p-6">
            <h2 className="mb-3 text-xl font-semibold">{title} ({arr.length})</h2>
            <ol className="space-y-3">
              {arr.map((q,i)=>(
                <li key={i} className="rounded-lg bg-secondary/30 p-4">
                  <div className="font-medium">{i+1}. {q.question}</div>
                  <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{q.answer}</div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      {c.programming?.length ? (
        <section className="glass rounded-2xl p-6">
          <h2 className="mb-3 text-xl font-semibold">Programming Questions ({c.programming.length})</h2>
          <ol className="space-y-4">
            {c.programming.map((p,i)=>(
              <li key={i} className="rounded-lg bg-secondary/30 p-4">
                <div className="font-medium">{i+1}. {p.question}</div>
                <pre className="mt-2 overflow-auto rounded-md bg-black/40 p-3 text-xs"><code>{p.sample_code}</code></pre>
                <div className="mt-2 text-xs text-muted-foreground">{p.explanation}</div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
