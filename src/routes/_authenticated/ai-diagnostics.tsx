import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { runAiDiagnostics } from "@/lib/ai-diagnostics.functions";

export const Route = createFileRoute("/_authenticated/ai-diagnostics")({
  component: AiDiagnosticsPage,
  head: () => ({
    meta: [
      { title: "AI Diagnostics — StaffMate AI" },
      { name: "description", content: "Admin-only health checks for the AI generation pipeline: provider, key, endpoint, model, quota and response time." },
      { property: "og:title", content: "AI Diagnostics — StaffMate AI" },
      { property: "og:description", content: "Admin-only health checks for the AI generation pipeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Badge({ status }: { status: "pass" | "fail" | "warn" }) {
  if (status === "pass")
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> PASS</span>;
  if (status === "warn")
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> WARN</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"><XCircle className="h-3.5 w-3.5" /> FAIL</span>;
}

function AiDiagnosticsPage() {
  const run = useServerFn(runAiDiagnostics);
  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["ai-diagnostics"],
    queryFn: () => run(),
    refetchOnWindowFocus: false,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">AI Diagnostics</h1>
          <p className="text-muted-foreground">Admin-only. Runs a real AI request end to end and reports every stage.</p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Run checks
        </Button>
      </div>

      <Card className="glass p-6">
        {isFetching && !data ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Running a live AI request…</div>
        ) : data ? (
          <div className="flex items-center gap-3">
            {data.ready ? (
              <>
                <Sparkles className="h-6 w-6 text-emerald-500" />
                <div>
                  <div className="text-xl font-semibold text-emerald-500">AI Ready</div>
                  <div className="text-xs text-muted-foreground">Confirmed by a successful live request at {new Date(data.checkedAt).toLocaleTimeString()}.</div>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-6 w-6 text-destructive" />
                <div>
                  <div className="text-xl font-semibold text-destructive">AI Not Ready</div>
                  <div className="text-xs text-muted-foreground">The live request did not succeed — see the failing check below.</div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-sm text-destructive">{error ? "Diagnostics could not run." : "No results yet."}</div>
        )}
      </Card>

      {data && (
        <Card className="glass divide-y divide-border/40 p-2">
          {data.checks.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="font-medium">{c.label}</div>
                <div className="mt-1 break-words text-xs text-muted-foreground">{c.detail}</div>
                {c.fix && (
                  <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    <span className="font-semibold">Recommended fix: </span>{c.fix}
                  </div>
                )}
              </div>
              <Badge status={c.status} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
