import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Send } from "lucide-react";
import { getNotificationDiagnostics, sendTestNotification } from "@/lib/notifications.functions";
import { currentPermission, isSWRegistered } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated/diagnostics")({
  component: DiagnosticsPage,
});

function Row({ label, ok, detail }: { label: string; ok: boolean | "warn"; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-3 last:border-0">
      <div>
        <div className="font-medium">{label}</div>
        {detail && <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>}
      </div>
      {ok === true ? (
        <span className="inline-flex items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> OK</span>
      ) : ok === "warn" ? (
        <span className="inline-flex items-center gap-1 text-sm text-amber-400"><AlertTriangle className="h-4 w-4" /> Not configured</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-sm text-red-400"><XCircle className="h-4 w-4" /> Missing</span>
      )}
    </div>
  );
}

function DiagnosticsPage() {
  const fetchDiag = useServerFn(getNotificationDiagnostics);
  const sendTest = useServerFn(sendTestNotification);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["notif-diagnostics"],
    queryFn: () => fetchDiag(),
  });
  const [swOk, setSwOk] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [testing, setTesting] = useState(false);
  const [lastTest, setLastTest] = useState<Awaited<ReturnType<typeof sendTest>> | null>(null);

  useEffect(() => {
    setPerm(currentPermission());
    isSWRegistered().then(setSwOk);
  }, []);

  const runTest = async () => {
    setTesting(true);
    try {
      const res = await sendTest();
      setLastTest(res);
      const pushOk = res.push.some((p: { status: string }) => p.status === "success");
      const anyOk = pushOk || res.email.status === "success" || res.sms.status === "success";
      if (anyOk) toast.success("Test notification sent");
      else toast.error("All test channels failed or were skipped — see details below");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  };

  if (isLoading || !data) return <div className="text-muted-foreground">Loading diagnostics…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notification Diagnostics</h1>
        <p className="text-muted-foreground">Verify every part of the notification pipeline.</p>
      </div>

      <Card className="glass p-6">
        <h2 className="mb-2 font-semibold">Configuration</h2>
        <Row label="Firebase initialized" ok={data.firebaseConfigured} detail="FIREBASE_PROJECT_ID and FIREBASE_API_KEY set on server" />
        <Row label="VAPID key present" ok={data.vapidConfigured} detail="Required for web push token generation" />
        <Row label="Service account (server sending)" ok={data.serviceAccountConfigured} detail="FIREBASE_SERVICE_ACCOUNT_JSON — required to send FCM from the server" />
        <Row label="Email sending" ok={data.emailConfigured ? true : "warn"} detail={data.emailConfigured ? "Lovable Emails enabled" : "Enable an email domain in Cloud → Emails to send reminder emails"} />
        <Row
          label="SMS sending"
          ok={data.smsConfigured ? true : "warn"}
          detail={data.smsConfigured ? "Twilio configured" : "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to enable SMS"}
        />
      </Card>

      <Card className="glass p-6">
        <h2 className="mb-2 font-semibold">This browser</h2>
        <Row label="Service Worker registered" ok={swOk === true} detail="/firebase-messaging-sw.js should be active" />
        <Row
          label="Browser permission"
          ok={perm === "granted" ? true : perm === "denied" ? false : "warn"}
          detail={`Current: ${perm}`}
        />
        <Row label="Registered devices" ok={data.deviceCount > 0} detail={`${data.deviceCount} device${data.deviceCount === 1 ? "" : "s"} for your account`} />
      </Card>

      <Card className="glass p-6">
        <h2 className="mb-2 font-semibold">Scheduler</h2>
        {data.scheduler ? (
          <>
            <Row label="Daily reminder" ok={data.scheduler.enabled} detail={`${data.scheduler.time} ${data.scheduler.timezone}`} />
            <Row label="Last sent" ok={!!data.scheduler.lastSent ? true : "warn"} detail={data.scheduler.lastSent ?? "Never"} />
          </>
        ) : (
          <div className="text-sm text-muted-foreground">No scheduler configured yet. Visit Notifications to set one up.</div>
        )}
      </Card>

      <Card className="glass p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Send test</h2>
          <Button onClick={runTest} disabled={testing}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send test notification
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Sends a push to all your devices, plus email and SMS if configured.</p>
        {lastTest && (
          <div className="mt-4 space-y-3 text-sm">
            <TestChannel label="Push" results={lastTest.push} />
            <TestChannel label="Email" results={[lastTest.email]} />
            <TestChannel label="SMS" results={[lastTest.sms]} />
          </div>
        )}
      </Card>

      <Card className="glass p-6">
        <h2 className="mb-2 font-semibold">Recent deliveries</h2>
        {data.recentDeliveries.length === 0 ? (
          <div className="text-sm text-muted-foreground">No deliveries yet.</div>
        ) : (
          <div className="space-y-2">
            {data.recentDeliveries.map((d: { channel: string; status: string; error: string | null; created_at: string }, i: number) => (
              <div key={i} className="flex items-center justify-between rounded border border-border/40 p-2 text-sm">
                <div>
                  <span className="font-medium capitalize">{d.channel}</span>
                  <span className="ml-2 text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                </div>
                <div className={d.status === "success" ? "text-emerald-400" : d.status === "failed" ? "text-red-400" : "text-amber-400"}>
                  {d.status}{d.error ? ` — ${d.error}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function TestChannel({ label, results }: { label: string; results: Array<{ status: string; target?: string; error?: string }> }) {
  return (
    <div className="rounded border border-border/40 p-3">
      <div className="mb-1 font-medium">{label}</div>
      {results.length === 0 ? (
        <div className="text-xs text-muted-foreground">No result</div>
      ) : results.map((r, i) => (
        <div key={i} className="text-xs">
          <span className={r.status === "success" ? "text-emerald-400" : r.status === "failed" ? "text-red-400" : "text-amber-400"}>
            {r.status}
          </span>
          {r.target && <span className="ml-2 text-muted-foreground">{r.target}</span>}
          {r.error && <div className="mt-0.5 text-muted-foreground">{r.error}</div>}
        </div>
      ))}
    </div>
  );
}
