import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Presentation, ClipboardList, BookOpen, Calendar, Bell,
  Sparkles, TrendingUp, Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Counts = { notes: number; ppts: number; papers: number; bank: number; reminders: number };

function Dashboard() {
  const [name, setName] = useState<string>("");
  const [counts, setCounts] = useState<Counts>({ notes: 0, ppts: 0, papers: 0, bank: 0, reminders: 0 });
  const [pending, setPending] = useState<Array<{ id: string; title: string; due_date: string | null; priority: string | null }>>([]);
  const [recentNotes, setRecentNotes] = useState<Array<{ id: string; subject: string; topic: string; created_at: string }>>([]);
  const [today, setToday] = useState<Array<{ period: number; subject: string | null; class_name: string | null; start_time: string | null }>>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle();
      setName(profile?.full_name ?? u.user?.email ?? "");

      const [notes, ppts, papers, bank, reminders] = await Promise.all([
        supabase.from("notes").select("id", { count: "exact", head: true }),
        supabase.from("ppts").select("id", { count: "exact", head: true }),
        supabase.from("question_papers").select("id", { count: "exact", head: true }),
        supabase.from("question_bank").select("id", { count: "exact", head: true }),
        supabase.from("reminders").select("id", { count: "exact", head: true }).eq("is_completed", false),
      ]);
      setCounts({
        notes: notes.count ?? 0,
        ppts: ppts.count ?? 0,
        papers: papers.count ?? 0,
        bank: bank.count ?? 0,
        reminders: reminders.count ?? 0,
      });

      const { data: rem } = await supabase
        .from("reminders")
        .select("id,title,due_date,priority")
        .eq("is_completed", false)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(5);
      setPending(rem ?? []);

      const { data: rn } = await supabase
        .from("notes")
        .select("id,subject,topic,created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentNotes(rn ?? []);

      const dow = new Date().getDay();
      const { data: tt } = await supabase
        .from("timetable_entries")
        .select("period,subject,class_name,start_time")
        .eq("day_of_week", dow)
        .order("period");
      setToday(tt ?? []);
    })();
  }, []);

  const stats = [
    { label: "Notes", value: counts.notes, icon: FileText, to: "/notes" },
    { label: "Presentations", value: counts.ppts, icon: Presentation, to: "/ppt" },
    { label: "Question Papers", value: counts.papers, icon: ClipboardList, to: "/question-papers" },
    { label: "Question Banks", value: counts.bank, icon: BookOpen, to: "/question-bank" },
    { label: "Open Reminders", value: counts.reminders, icon: Bell, to: "/reminders" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Welcome back</div>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{name || "Faculty"}</h1>
          <p className="mt-1 text-muted-foreground">Your AI teaching workspace at a glance.</p>
        </div>
        <Link to="/notes/new" className="rounded-lg gradient-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground glow-ring inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Generate Notes
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="glass rounded-2xl p-4 transition hover:glow-ring">
            <s.icon className="h-5 w-5 text-primary" />
            <div className="mt-3 text-3xl font-bold">{s.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Today's Classes</h2>
          </div>
          {today.length === 0 ? (
            <EmptyRow label="No classes today. Set up your weekly timetable." link="/timetable" />
          ) : (
            <ul className="space-y-2">
              {today.map((t, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-md gradient-brand text-xs font-bold text-primary-foreground">P{t.period}</span>
                    <div>
                      <div className="font-medium">{t.subject ?? "Free"}</div>
                      <div className="text-xs text-muted-foreground">{t.class_name ?? "—"}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{t.start_time ?? ""}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Pending Reminders</h2>
          </div>
          {pending.length === 0 ? (
            <EmptyRow label="Nothing pending. You're on track." link="/reminders" />
          ) : (
            <ul className="space-y-2">
              {pending.map((r) => (
                <li key={r.id} className="rounded-lg bg-secondary/40 p-3 text-sm">
                  <div className="font-medium">{r.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {r.due_date ? new Date(r.due_date).toLocaleString() : "No due date"}
                    <span className="ml-auto rounded bg-primary/20 px-1.5 py-0.5 text-[10px] uppercase text-primary">{r.priority}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass rounded-2xl p-5 lg:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Recent Notes</h2>
          </div>
          {recentNotes.length === 0 ? (
            <EmptyRow label="Generate your first AI-powered notes." link="/notes/new" cta="Create" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentNotes.map((n) => (
                <Link key={n.id} to="/notes/$id" params={{ id: n.id }} className="rounded-xl border border-border/50 bg-secondary/30 p-4 hover:border-primary/50">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{n.subject}</div>
                  <div className="mt-1 font-semibold">{n.topic}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyRow({ label, link, cta = "Open" }: { label: string; link: string; cta?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
      <span>{label}</span>
      <Link to={link} className="rounded-md gradient-brand px-3 py-1.5 text-xs font-medium text-primary-foreground">{cta}</Link>
    </div>
  );
}
