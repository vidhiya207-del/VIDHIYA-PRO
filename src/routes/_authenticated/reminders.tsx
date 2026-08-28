import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Trash2, Check, Pause, Play, Copy, Archive, ArchiveRestore, Pencil, Bell, Mail, MessageSquare, Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  REMINDER_TYPES, REPEAT_RULES, PRIORITIES, METHODS, WEEKDAYS, TIMEZONES,
  type Reminder, priorityClass, describeSchedule,
} from "@/lib/reminder-config";

export const Route = createFileRoute("/_authenticated/reminders")({
  component: Reminders,
  head: () => ({
    meta: [
      { title: "Smart Reminders | StaffMate AI" },
      { name: "description", content: "Create study, exam, assignment and deadline reminders with repeat rules, priorities and multi-channel delivery." },
      { property: "og:title", content: "Smart Reminders | StaffMate AI" },
      { property: "og:description", content: "Timezone-aware reminders delivered by push, email and SMS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const emptyForm = () => ({
  id: null as string | null,
  title: "",
  description: "",
  subject: "",
  topic: "",
  reminder_type: "Daily Study Reminder",
  category: "Meeting",
  priority: "medium",
  repeat_rule: "none",
  repeat_days: [] as number[],
  timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"; } catch { return "Asia/Kolkata"; } })(),
  methods: ["push"] as string[],
  due_date: "",
});

function Reminders() {
  const [rows, setRows] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("reminders").select("*")
      .order("is_completed").order("due_date", { ascending: true, nullsFirst: false });
    setRows((data ?? []) as unknown as Reminder[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const t = window.setInterval(() => void load(), 60000);
    return () => { window.removeEventListener("focus", onFocus); window.clearInterval(t); };
  }, [load]);

  const visible = useMemo(() => rows.filter((r) => {
    if (r.is_archived !== showArchived) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return `${r.title} ${r.description ?? ""} ${r.subject ?? ""} ${r.topic ?? ""} ${r.reminder_type}`.toLowerCase().includes(q);
  }), [rows, showArchived, query]);

  const openNew = () => { setForm(emptyForm()); setOpen(true); };
  const openEdit = (r: Reminder) => {
    setForm({
      id: r.id,
      title: r.title,
      description: r.description ?? "",
      subject: r.subject ?? "",
      topic: r.topic ?? "",
      reminder_type: r.reminder_type,
      category: r.category ?? "Meeting",
      priority: ["low", "medium", "high"].includes(r.priority ?? "") ? r.priority! : "medium",
      repeat_rule: r.repeat_rule,
      repeat_days: r.repeat_days ?? [],
      timezone: r.timezone,
      methods: r.methods?.length ? r.methods : ["push"],
      due_date: r.due_date ? toLocalInput(r.due_date) : "",
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Please give your reminder a title.");
    if (!form.methods.length) return toast.error("Choose at least one delivery method.");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(false); return; }
    const payload = {
      user_id: u.user.id,
      title: form.title.trim(),
      description: form.description || null,
      subject: form.subject || null,
      topic: form.topic || null,
      reminder_type: form.reminder_type,
      category: form.category,
      priority: form.priority,
      repeat_rule: form.repeat_rule,
      repeat_days: form.repeat_rule === "custom" ? form.repeat_days : [],
      timezone: form.timezone,
      methods: form.methods,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
    };
    const { error } = form.id
      ? await supabase.from("reminders").update(payload).eq("id", form.id)
      : await supabase.from("reminders").insert(payload);
    setSaving(false);
    if (error) return toast.error("We couldn't save this reminder. Please try again.");
    toast.success(form.id ? "Reminder updated" : "Reminder created");
    setOpen(false);
    void load();
  };

  const patch = async (id: string, values: Partial<{ is_completed: boolean; is_paused: boolean; is_archived: boolean }>, msg: string) => {
    const { error } = await supabase.from("reminders").update(values).eq("id", id);
    if (error) return toast.error("That change didn't go through.");
    toast.success(msg);
    void load();
  };

  const duplicate = async (r: Reminder) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("reminders").insert({
      user_id: u.user.id, title: `${r.title} (copy)`, description: r.description, subject: r.subject, topic: r.topic,
      reminder_type: r.reminder_type, category: r.category, priority: r.priority, repeat_rule: r.repeat_rule,
      repeat_days: r.repeat_days, timezone: r.timezone, methods: r.methods, due_date: r.due_date,
    });
    if (error) return toast.error("Couldn't duplicate that reminder.");
    toast.success("Reminder duplicated");
    void load();
  };

  const remove = async (id: string) => {
    await supabase.from("reminders").delete().eq("id", id);
    setSelected((s) => s.filter((x) => x !== id));
    void load();
  };

  const bulkDelete = async () => {
    if (!selected.length) return;
    await supabase.from("reminders").delete().in("id", selected);
    toast.success(`${selected.length} reminder${selected.length === 1 ? "" : "s"} deleted`);
    setSelected([]);
    void load();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Smart Reminders</h1>
          <p className="text-muted-foreground">Study, exams, assignments and deadlines — delivered on time, every time.</p>
        </div>
        <Button onClick={openNew} className="gradient-brand text-primary-foreground"><Plus className="mr-2 h-4 w-4" />New reminder</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reminders" className="h-9 w-56 pl-8" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Switch checked={showArchived} onCheckedChange={(v) => { setShowArchived(v); setSelected([]); }} />
          <span className="text-muted-foreground">Show archived</span>
        </div>
        {selected.length > 0 && (
          <Button variant="outline" size="sm" onClick={bulkDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete {selected.length}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/40" />)}</div>
      ) : visible.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          {showArchived ? "Nothing archived." : "No reminders yet — create your first one."}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => (
            <div key={r.id} className={`glass rounded-xl p-4 transition ${r.is_completed || r.is_paused ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" className="mt-2 h-4 w-4 accent-current"
                  checked={selected.includes(r.id)}
                  onChange={(e) => setSelected((s) => e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id))} />
                <button onClick={() => patch(r.id, { is_completed: !r.is_completed }, r.is_completed ? "Marked active" : "Marked complete")}
                  className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border ${r.is_completed ? "gradient-brand border-transparent text-primary-foreground" : "border-border"}`}>
                  {r.is_completed && <Check className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${r.is_completed ? "line-through" : ""}`}>{r.title}</div>
                  {r.description && <div className="truncate text-xs text-muted-foreground">{r.description}</div>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-secondary/60 px-1.5 py-0.5">{r.reminder_type}</span>
                    <span className={`rounded px-1.5 py-0.5 uppercase ${priorityClass(r.priority)}`}>{r.priority ?? "normal"}</span>
                    {r.subject && <span className="text-muted-foreground">{r.subject}{r.topic ? ` · ${r.topic}` : ""}</span>}
                    <span className="text-muted-foreground">{describeSchedule(r)}</span>
                    {r.is_paused && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-500">Paused</span>}
                    <span className="flex items-center gap-1 text-muted-foreground">
                      {r.methods?.includes("push") && <Bell className="h-3 w-3" />}
                      {r.methods?.includes("email") && <Mail className="h-3 w-3" />}
                      {r.methods?.includes("sms") && <MessageSquare className="h-3 w-3" />}
                    </span>
                    {r.sent_count > 0 && <span className="text-muted-foreground">Sent {r.sent_count}×</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <IconBtn title={r.is_paused ? "Resume" : "Pause"} onClick={() => patch(r.id, { is_paused: !r.is_paused }, r.is_paused ? "Resumed" : "Paused")}>
                    {r.is_paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </IconBtn>
                  <IconBtn title="Edit" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></IconBtn>
                  <IconBtn title="Duplicate" onClick={() => duplicate(r)}><Copy className="h-4 w-4" /></IconBtn>
                  <IconBtn title={r.is_archived ? "Restore" : "Archive"} onClick={() => patch(r.id, { is_archived: !r.is_archived }, r.is_archived ? "Restored" : "Archived")}>
                    {r.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </IconBtn>
                  <IconBtn title="Delete" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></IconBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? "Edit reminder" : "New reminder"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Title</Label>
              <Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Revise Operating Systems – Unit 3" />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details" />
            </div>
            <div><Label>Subject</Label><Input className="mt-1" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div><Label>Topic</Label><Input className="mt-1" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></div>
            <div>
              <Label>Reminder type</Label>
              <select value={form.reminder_type} onChange={(e) => setForm({ ...form, reminder_type: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {REMINDER_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Priority</Label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div><Label>Date & time</Label><Input type="datetime-local" className="mt-1" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div>
              <Label>Time zone</Label>
              <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Repeat</Label>
              <select value={form.repeat_rule} onChange={(e) => setForm({ ...form, repeat_rule: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {REPEAT_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {form.repeat_rule === "custom" && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d, i) => (
                    <button type="button" key={d}
                      onClick={() => setForm({ ...form, repeat_days: form.repeat_days.includes(i) ? form.repeat_days.filter((x) => x !== i) : [...form.repeat_days, i] })}
                      className={`rounded-full border px-3 py-1 text-xs ${form.repeat_days.includes(i) ? "gradient-brand border-transparent text-primary-foreground" : "border-border text-muted-foreground"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label>Delivery methods</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {METHODS.map((m) => (
                  <button type="button" key={m.value}
                    onClick={() => setForm({ ...form, methods: form.methods.includes(m.value) ? form.methods.filter((x) => x !== m.value) : [...form.methods, m.value] })}
                    className={`rounded-full border px-3 py-1 text-xs ${form.methods.includes(m.value) ? "gradient-brand border-transparent text-primary-foreground" : "border-border text-muted-foreground"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                We try push first, then fall back to email and SMS automatically so a reminder is never silently lost.
              </p>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gradient-brand text-primary-foreground">
                {saving ? "Saving..." : form.id ? "Save changes" : "Create reminder"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className="rounded-md p-2 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground">
      {children}
    </button>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
