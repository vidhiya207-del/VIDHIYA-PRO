import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatMathDeep } from "@/lib/math-format";
import { ArrowLeft, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/question-papers/$id")({
  component: PaperView,
});

type Question = { q_no: string; question: string; marks: number; bloom_level?: string; answer_hint?: string };
type Part = { name: string; marks_each: number; count: number; questions: Question[] };
type Header = { college?: string; subject?: string; duration?: string; max_marks?: number; instructions?: string[] };
type Row = { id: string; title: string; subject: string; unit: string | null; total_marks: number | null; content: { header?: Header; parts?: Part[] } };

function PaperView() {
  const { id } = Route.useParams();
  const [row, setRow] = useState<Row | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("question_papers").select("*").eq("id", id).maybeSingle();
      setRow(data ? formatMathDeep(data as Row) : null);
    })();
  }, [id]);
  if (!row) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const h = row.content.header;
  const parts = row.content.parts ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex justify-between print:hidden">
        <Link to="/question-papers" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> All papers</Link>
        <button onClick={() => window.print()} className="rounded-md gradient-brand px-3 py-2 text-sm font-medium text-primary-foreground inline-flex items-center gap-2"><Printer className="h-4 w-4"/> Print / PDF</button>
      </div>
      <div className="glass rounded-2xl p-8 print:bg-white print:text-black print:shadow-none">
        <div className="text-center">
          <div className="text-lg font-bold">{h?.college ?? "College of Engineering"}</div>
          <div className="text-sm text-muted-foreground print:text-gray-600">{row.title}</div>
          <div className="mt-2 flex justify-center gap-6 text-sm">
            <span><b>Subject:</b> {row.subject}</span>
            <span><b>Duration:</b> {h?.duration ?? "3 hours"}</span>
            <span><b>Max Marks:</b> {h?.max_marks ?? row.total_marks}</span>
          </div>
        </div>
        {h?.instructions?.length ? (
          <div className="mt-4 text-sm">
            <b>Instructions:</b>
            <ol className="ml-6 list-decimal">{h.instructions.map((i, k)=><li key={k}>{i}</li>)}</ol>
          </div>
        ): null}

        <div className="mt-6 space-y-6">
          {parts.map((p, i) => (
            <div key={i}>
              <div className="font-semibold">{p.name} — Answer all questions ({p.count} × {p.marks_each} = {p.count * p.marks_each} marks)</div>
              <ol className="mt-2 space-y-2">
                {p.questions.map((q, j) => (
                  <li key={j} className="text-sm">
                    <div><b>{q.q_no}.</b> {q.question} <span className="float-right text-muted-foreground print:text-gray-600">[{q.marks} M]</span></div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
