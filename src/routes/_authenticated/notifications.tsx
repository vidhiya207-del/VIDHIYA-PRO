import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Trash2, Send, Mail, MessageSquare, Smartphone, Bell, Clock,
  CheckCircle2, XCircle, Timer, TrendingUp, Loader2, Search,
} from "lucide-react";
import { NotificationPermissionCard } from "@/components/NotificationPermissionCard";
import { getMyDevices, removeDevice, sendTestNotification } from "@/lib/notifications.functions";
import { TIMEZONES, type Reminder, describeSchedule } from "@/lib/reminder-config";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
  head: () => ({
    meta: [
      { title: "Notification Center | StaffMate AI" },
      { name: "description", content: "Manage push, email and SMS reminders, devices and delivery history in one place." },
      { property: "og:title", content: "Notification Center | StaffMate AI" },
      { property: "og:description", content: "Smart, reliable reminder delivery across push, email and SMS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Device = { id: string; browser: string | null; platform: string | null; last_active_at: string; staff_name: string | null };
type Delivery = { id: string; channel: string; status: string; target: string | null; error: string | null; created_at: string; title: string | null; opened_at: string | null; clicked_at: string | null };

function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [notifyTime, setNotifyTime] = useState("19:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  const [devices, setDevices] = useState<Device[]>([]);
  const [history, setHistory] = useState<Delivery[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [query, setQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const devicesFn = useServerFn(getMyDevices);
  const removeFn = useServerFn(removeDevice);
  const testFn = useServerFn(sendTestNotification);

  const refreshDevices = useCallback(async () => {
    try {
      const { devices } = await devicesFn();
      setDevices(devices);
    } catch (e) { console.error(e); }
  }, [devicesFn]);

  const refreshData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const [{ data: h }, { data: rem }] = await Promise.all([
      supabase.from("notification_deliveries")
        .select("id, channel, status, target, error, created_at, title, opened_at, clicked_at")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(100),
      supabase.from("reminders").select("*").eq("user_id", uid).eq("is_archived", false),
    ]);
    setHistory((h ?? []) as Delivery[]);
    setReminders((rem ?? []) as unknown as Reminder[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const { data: s } = await supabase.from("notification_settings").select("*").eq("user_id", uid).maybeSingle();
      if (s) {
        setEnabled(s.enabled);
        setPushEnabled(s.push_enabled);
        setEmailEnabled(s.email_enabled);
        setSmsEnabled(s.sms_enabled);
        setNotifyTime((s.notify_time as string).slice(0, 5));
        setTimezone(s.timezone);
      } else {
        try { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"); } catch { /* ignore */ }
      }
      await Promise.all([refreshDevices(), refreshData()]);
      setLoading(false);
    })();
  }, [refreshDevices, refreshData]);

  // Live-ish updates without manual refresh
  useEffect(() => {
    const t = window.setInterval(() => { void refreshData(); }, 30000);
    const onFocus = () => void refreshData();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [refreshData]);

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSaving(false); return; }
    const { error } = await supabase.from("notification_settings").upsert({
      user_id: uid,
      enabled,
      push_enabled: pushEnabled,
      email_enabled: emailEnabled,
      sms_enabled: smsEnabled,
      notify_time: notifyTime + ":00",
      timezone,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error("We couldn't save your preferences. Please try again.");
    else toast.success("Notification preferences saved");
  };

  const removeDeviceHandler = async (id: string) => {
    try {
      await removeFn({ data: { id } });
      toast.success("Device removed");
      await refreshDevices();
    } catch { toast.error("Couldn't remove that device."); }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await testFn();
      const delivered = [...res.push, res.email, res.sms].some((item) => item.status === "success");
      if (delivered) toast.success("Test sent — check your email, SMS, or device");
      else toast.error("No test channel could deliver", { description: "Check your email/mobile in Profile and provider setup in Diagnostics." });
      await Promise.all([refreshData(), refreshDevices()]);
    } catch (e) {
      toast.error("Test failed", { description: e instanceof Error ? e.message : "Unknown error" });
    }
    finally { setTesting(false); }
  };

  const stats = useMemo(() => {
    const sent = history.filter((h) => h.status === "success").length;
    const failed = history.filter((h) => h.status === "failed").length;
    const skipped = history.filter((h) => h.status === "skipped").length;
    const total = sent + failed;
    const active = reminders.filter((r) => !r.is_completed && !r.is_paused);
    const upcoming = active
      .filter((r) => r.due_date && new Date(r.due_date).getTime() > Date.now())
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
    const todayStr = new Date().toDateString();
    const today = active.filter((r) => r.due_date && new Date(r.due_date).toDateString() === todayStr);
    const missed = active.filter((r) => r.due_date && new Date(r.due_date).getTime() < Date.now() && r.repeat_rule === "none");
    return {
      sent, failed, skipped,
      successRate: total ? Math.round((sent / total) * 100) : 0,
      pending: active.length,
      completed: reminders.filter((r) => r.is_completed).length,
      today: today.length,
      missed: missed.length,
      next: upcoming[0] ?? null,
      last: history[0] ?? null,
    };
  }, [history, reminders]);

  const filteredHistory = useMemo(() => history.filter((h) => {
    if (channelFilter !== "all" && h.channel !== channelFilter) return false;
    if (statusFilter !== "all" && h.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!`${h.title ?? ""} ${h.channel} ${h.status} ${h.target ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [history, channelFilter, statusFilter, query]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/40" />)}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notification Center</h1>
        <p className="text-muted-foreground">Permissions, channels, devices and delivery history — all live.</p>
      </div>

      <NotificationPermissionCard deviceCount={devices.length} onRegistered={refreshDevices} />

      <div className="glass rounded-2xl p-5">
        <div className="font-semibold">Set up reminders in 3 steps</div>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 p-3">
            <div className="font-medium">1. Add your contact</div>
            <p className="mt-1 text-muted-foreground">Check your email and add a mobile number for SMS.</p>
            <Link to="/profile" className="mt-2 inline-block text-primary underline">Open Profile</Link>
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <div className="font-medium">2. Choose delivery methods</div>
            <p className="mt-1 text-muted-foreground">Turn on push, email, or SMS below, then save your preferences.</p>
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <div className="font-medium">3. Send a test</div>
            <p className="mt-1 text-muted-foreground">Use Send test to confirm which notification method reached you.</p>
          </div>
        </div>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={<Clock className="h-4 w-4" />} label="Today's reminders" value={stats.today} />
        <StatCard icon={<Timer className="h-4 w-4" />} label="Pending" value={stats.pending} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={stats.completed} />
        <StatCard icon={<XCircle className="h-4 w-4" />} label="Missed" value={stats.missed} tone="warn" />
        <StatCard icon={<Send className="h-4 w-4" />} label="Delivered" value={stats.sent} tone="ok" />
        <StatCard icon={<XCircle className="h-4 w-4" />} label="Failed" value={stats.failed} tone="bad" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Success rate" value={`${stats.successRate}%`} tone="ok" />
        <StatCard icon={<Smartphone className="h-4 w-4" />} label="Devices" value={devices.length} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Next scheduled</div>
          <div className="mt-1 font-semibold">{stats.next ? stats.next.title : "Nothing scheduled"}</div>
          <div className="text-sm text-muted-foreground">
            {stats.next ? describeSchedule(stats.next) : <>Create one in <Link to="/reminders" className="underline">Reminders</Link>.</>}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Last notification</div>
          <div className="mt-1 font-semibold">{stats.last ? (stats.last.title ?? "Reminder") : "None yet"}</div>
          <div className="text-sm text-muted-foreground">
            {stats.last ? `${stats.last.channel} · ${stats.last.status} · ${new Date(stats.last.created_at).toLocaleString()}` : "Send a test to try it out."}
          </div>
        </div>
      </div>

      {/* Channels */}
      <div className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Delivery methods</div>
            <div className="text-sm text-muted-foreground">Pick every channel you want reminders on. We fall back automatically if one fails.</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <ChannelToggle icon={<Bell className="h-4 w-4" />} label="Browser & mobile push" checked={pushEnabled} onChange={setPushEnabled} disabled={!enabled} />
          <ChannelToggle icon={<Mail className="h-4 w-4" />} label="Email" checked={emailEnabled} onChange={setEmailEnabled} disabled={!enabled} />
          <ChannelToggle icon={<MessageSquare className="h-4 w-4" />} label="SMS" checked={smsEnabled} onChange={setSmsEnabled} disabled={!enabled} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="time">Daily reminder time</Label>
            <Input id="time" type="time" value={notifyTime} onChange={(e) => setNotifyTime(e.target.value)} disabled={!enabled} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="tz">Time zone</Label>
            <select id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={!enabled}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={sendTest} disabled={testing}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send test
          </Button>
          <Button onClick={save} disabled={saving} className="gradient-brand text-primary-foreground">
            {saving ? "Saving..." : "Save preferences"}
          </Button>
        </div>
      </div>

      {/* Devices */}
      <div className="glass rounded-2xl p-6 space-y-3">
        <div className="font-semibold">Registered devices</div>
        {devices.length === 0 ? (
          <div className="text-sm text-muted-foreground">No devices yet — allow notifications above to register this one.</div>
        ) : devices.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/40 p-3 text-sm">
            <div>
              <div className="font-medium">{d.browser || "Unknown browser"} · {d.platform || "Unknown platform"}</div>
              <div className="text-xs text-muted-foreground">Last active {new Date(d.last_active_at).toLocaleString()}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => removeDeviceHandler(d.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <div className="text-xs text-muted-foreground">
          Something not working? Open <Link to="/diagnostics" className="underline">Diagnostics</Link>.
        </div>
      </div>

      {/* History */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-semibold">Notification history</div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="h-9 w-40 pl-8" />
            </div>
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="all">All channels</option><option value="push">Push</option><option value="email">Email</option><option value="sms">SMS</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="all">All statuses</option><option value="success">Delivered</option><option value="failed">Failed</option><option value="skipped">Skipped</option>
            </select>
          </div>
        </div>
        {filteredHistory.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            No notifications match your filters yet.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredHistory.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-lg border border-border/40 p-3 text-sm">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                  h.status === "success" ? "bg-emerald-500/15 text-emerald-500" :
                  h.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                  {h.channel === "email" ? <Mail className="h-4 w-4" /> : h.channel === "sms" ? <MessageSquare className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{h.title ?? "Reminder"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString()} · {h.channel} · {h.status === "success" ? "Delivered" : h.status === "failed" ? "Failed" : "Skipped"}
                    {h.opened_at ? " · Opened" : ""}{h.clicked_at ? " · Clicked" : ""}
                  </div>
                  {h.status !== "success" && h.error && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{softenError(h.error)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone?: "ok" | "bad" | "warn" }) {
  const toneCls = tone === "ok" ? "text-emerald-500" : tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-500" : "text-primary";
  return (
    <div className="glass rounded-xl p-4">
      <div className={`flex items-center gap-2 text-xs ${toneCls}`}>{icon}<span className="text-muted-foreground">{label}</span></div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function ChannelToggle({ icon, label, checked, onChange, disabled }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-xl border border-border/40 p-3 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 text-sm">{icon}<span>{label}</span></div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function softenError(error: string) {
  if (/not configured/i.test(error)) return "This channel isn't set up yet — ask your admin to finish configuration.";
  if (/No registered devices/i.test(error)) return "No device was registered at the time.";
  if (/suppressed/i.test(error)) return "The recipient address is currently blocked from receiving mail.";
  return "Delivery didn't complete. We'll retry on the next scheduled run.";
}
