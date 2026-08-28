import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import { adminListStaff, adminSendNotification, adminListNotifications, getMyRole } from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/admin-notifications")({
  component: AdminPage,
});

interface Staff { id: string; full_name: string | null; email: string | null; department: string | null }

function AdminPage() {
  const roleFn = useServerFn(getMyRole);
  const staffFn = useServerFn(adminListStaff);
  const sendFn = useServerFn(adminSendNotification);
  const historyFn = useServerFn(adminListNotifications);

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [history, setHistory] = useState<Array<{ id: string; title: string; body: string; status: string; total_recipients: number; success_count: number; failure_count: number; scheduled_at: string | null; sent_at: string | null; created_at: string }>>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [pushCh, setPushCh] = useState(true);
  const [emailCh, setEmailCh] = useState(false);
  const [smsCh, setSmsCh] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await roleFn();
        setIsAdmin(r.isAdmin);
        if (r.isAdmin) {
          const [s, h] = await Promise.all([staffFn(), historyFn()]);
          setStaff(s.staff);
          setHistory(h.notifications);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body required"); return;
    }
    if (target === "selected" && selected.size === 0) {
      toast.error("Pick at least one recipient"); return;
    }
    if (!pushCh && !emailCh && !smsCh) {
      toast.error("Pick at least one channel"); return;
    }
    setSending(true);
    try {
      const res = await sendFn({
        data: {
          title, body, target,
          target_user_ids: target === "selected" ? [...selected] : [],
          scheduled_at: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          channels: { push: pushCh, email: emailCh, sms: smsCh },
        },
      });
      if (res.scheduled) toast.success(`Scheduled for ${res.recipients} recipients`);
      else toast.success(`Sent — ${res.success} succeeded, ${res.failure} failed`);
      setTitle(""); setBody(""); setSelected(new Set());
      const h = await historyFn();
      setHistory(h.notifications);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (checking) return <div className="text-muted-foreground">Loading…</div>;
  if (!isAdmin) return (
    <Card className="glass mx-auto max-w-xl p-8 text-center">
      <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-400" />
      <h1 className="text-xl font-bold">Admin access required</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This panel is for administrators. Ask an existing admin to grant you the <code className="rounded bg-muted px-1">admin</code> role in the <code className="rounded bg-muted px-1">user_roles</code> table.
      </p>
    </Card>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Notifications</h1>
        <p className="text-muted-foreground">Send manual notifications to staff.</p>
      </div>

      <Card className="glass space-y-4 p-6">
        <div>
          <Label htmlFor="t">Title</Label>
          <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="AI Staff Assistant" />
        </div>
        <div>
          <Label htmlFor="b">Body</Label>
          <Textarea id="b" value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Message…" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Recipients</Label>
            <div className="mt-2 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={target === "all"} onChange={() => setTarget("all")} />
                All staff ({staff.length})
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={target === "selected"} onChange={() => setTarget("selected")} />
                Selected
              </label>
            </div>
          </div>
          <div>
            <Label>Channels</Label>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={pushCh} onCheckedChange={(v) => setPushCh(!!v)} /> Push</label>
              <label className="flex items-center gap-2"><Checkbox checked={emailCh} onCheckedChange={(v) => setEmailCh(!!v)} /> Email</label>
              <label className="flex items-center gap-2"><Checkbox checked={smsCh} onCheckedChange={(v) => setSmsCh(!!v)} /> SMS</label>
            </div>
          </div>
        </div>

        {target === "selected" && (
          <div className="max-h-56 overflow-auto rounded border border-border/40 p-2">
            {staff.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40">
                <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                <span className="flex-1">{s.full_name || "(no name)"}</span>
                <span className="text-xs text-muted-foreground">{s.department || s.email}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={scheduleEnabled} onCheckedChange={(v) => setScheduleEnabled(!!v)} />
            Schedule for later
          </label>
          {scheduleEnabled && (
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-64" />
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={send} disabled={sending}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {scheduleEnabled ? "Schedule" : "Send now"}
          </Button>
        </div>
      </Card>

      <Card className="glass p-6">
        <h2 className="mb-3 font-semibold">Recent notifications</h2>
        {history.length === 0 ? (
          <div className="text-sm text-muted-foreground">No notifications yet.</div>
        ) : (
          <div className="space-y-2">
            {history.map((n) => (
              <div key={n.id} className="rounded border border-border/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{n.title}</div>
                  <span className={
                    n.status === "sent" ? "text-emerald-400" :
                    n.status === "failed" ? "text-red-400" :
                    n.status === "scheduled" ? "text-blue-400" : "text-amber-400"
                  }>{n.status}</span>
                </div>
                <div className="mt-1 text-muted-foreground">{n.body}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {n.total_recipients} recipients — {n.success_count} ok, {n.failure_count} failed
                  {n.scheduled_at ? ` — scheduled ${new Date(n.scheduled_at).toLocaleString()}` : ""}
                  {n.sent_at ? ` — sent ${new Date(n.sent_at).toLocaleString()}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
