import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Bell, BellRing, CheckCircle2, Loader2, ShieldAlert, Info, ExternalLink } from "lucide-react";
import { requestAndRegisterFCM, currentPermission, isSWRegistered } from "@/lib/firebase";
import { getEnableGuide, ENABLE_GUIDES, detectBrowserKey, type BrowserKey } from "@/lib/notification-help";
import { toast } from "sonner";

export type PermState = "checking" | "unsupported" | "default" | "granted" | "denied";

interface Props {
  deviceCount: number;
  onRegistered: () => void | Promise<void>;
}

export function NotificationPermissionCard({ deviceCount, onRegistered }: Props) {
  const [state, setState] = useState<PermState>("checking");
  const [busy, setBusy] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [guideKey, setGuideKey] = useState<BrowserKey>("other");
  const [swOk, setSwOk] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const registered = useRef(false);
  const inFlight = useRef(false);

  const register = useCallback(async (announce: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await requestAndRegisterFCM();
      setSwOk(await isSWRegistered());
      if (res.ok) {
        registered.current = true;
        setRegError(null);
        if (announce) {
          setJustEnabled(true);
          toast.success("Notifications enabled successfully");
          setTimeout(() => setJustEnabled(false), 3500);
        }
        await onRegistered();
      } else {
        registered.current = false;
        if (res.reason === "denied") setState("denied");
        else if (res.reason === "unsupported") setState("unsupported");
        else {
          setRegError(friendly(res.reason, res.message));
          if (announce) toast.error(friendly(res.reason, res.message));
        }
      }
    } catch (e) {
      registered.current = false;
      const msg = e instanceof Error ? e.message : String(e);
      setRegError(msg);
      if (announce) toast.error(msg);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [onRegistered]);


  const sync = useCallback(async (announceOnGrant: boolean) => {
    const p = currentPermission();
    if (p === "unsupported") { setState("unsupported"); return; }
    setState(p);
    if (p === "granted") {
      setSwOk(await isSWRegistered());
      if (!registered.current) await register(announceOnGrant);
    }
  }, [register]);


  useEffect(() => {
    setGuideKey(detectBrowserKey());
    void sync(false);

    let cleanup = () => {};
    (async () => {
      try {
        const status = await navigator.permissions?.query({ name: "notifications" as PermissionName });
        if (status) {
          const handler = () => void sync(true);
          status.addEventListener("change", handler);
          cleanup = () => status.removeEventListener("change", handler);
        }
      } catch { /* Permissions API unavailable — polling below covers it */ }
    })();

    const poll = window.setInterval(() => {
      const p = currentPermission();
      setState((prev) => {
        if (p !== "unsupported" && prev !== "checking" && prev !== p) void sync(true);
        return prev;
      });
    }, 2000);
    const onFocus = () => void sync(true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cleanup();
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [sync]);

  const ask = async () => {
    setBusy(true);
    await register(true);
    setBusy(false);
    await sync(true);
  };

  const guide = guideKey ? ENABLE_GUIDES[guideKey] : getEnableGuide();

  return (
    <>
      <div
        className={`glass rounded-2xl p-6 transition-all ${
          state === "granted" ? "ring-1 ring-emerald-500/40" : state === "denied" ? "ring-1 ring-amber-500/40" : ""
        } ${justEnabled ? "animate-in fade-in zoom-in-95 duration-500" : ""}`}
      >
        {state === "checking" && (
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-72 animate-pulse rounded bg-muted" />
            </div>
          </div>
        )}

        {state === "granted" && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${
                deviceCount > 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
              } ${justEnabled ? "animate-bounce" : ""}`}
            >
              {deviceCount > 0 ? <CheckCircle2 className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <div className={`font-semibold ${deviceCount > 0 ? "text-emerald-500" : "text-amber-500"}`}>
                {deviceCount > 0
                  ? "✅ Notifications enabled"
                  : busy ? "Setting up this device…" : "⚠ Permission granted, but this device isn't registered yet"}
              </div>
              <div className="text-sm text-muted-foreground">
                {deviceCount > 0
                  ? `Enabled on ${deviceCount} device${deviceCount === 1 ? "" : "s"} · Service worker ${swOk ? "active" : "starting…"} · Works in the background`
                  : regError ?? "Tap “Refresh this device” to finish registering it for background push."}
              </div>
            </div>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => { registered.current = false; setRegError(null); void register(true); }}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
              Refresh this device
            </Button>
          </div>

        )}

        {state === "default" && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Bell className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Turn on reminders</div>
              <div className="text-sm text-muted-foreground">
                Get your study, exam and deadline reminders even when this tab is closed.
              </div>
            </div>
            <Button onClick={ask} disabled={busy} className="gradient-brand text-primary-foreground">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
              Allow Notifications
            </Button>
          </div>
        )}

        {state === "denied" && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-amber-500">⚠ Notifications are currently blocked</div>
                <div className="text-sm text-muted-foreground">
                  Your browser has blocked alerts for this site. Follow the browser steps below, then return here and check again.
                  Email and SMS can be used as alternatives after you add your contact details and enable those delivery methods.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setHelpOpen(true)} className="gradient-brand text-primary-foreground">
                <Bell className="mr-2 h-4 w-4" /> Show browser steps
              </Button>
              <Button variant="outline" onClick={() => setHelpOpen(true)}>
                <Info className="mr-2 h-4 w-4" /> View all steps
              </Button>
              <Button variant="outline" onClick={() => void sync(true)} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Check permission again
              </Button>
              <Button variant="ghost" asChild>
                <a href={guide.learnMore} target="_blank" rel="noreferrer">
                  Learn More <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        )}

        {state === "unsupported" && (
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <BellRing className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Browser push isn't available here</div>
              <div className="text-sm text-muted-foreground">
                This browser doesn't support web push. Email reminders will be used instead — on iPhone, add this app to
                your Home Screen to unlock push.
              </div>
            </div>
            <Button variant="outline" onClick={() => setHelpOpen(true)}>How to Enable</Button>
          </div>
        )}
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>How to enable notifications</DialogTitle>
            <DialogDescription>Pick your browser — we detected {guide.label}.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(ENABLE_GUIDES) as BrowserKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setGuideKey(k)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  guideKey === k ? "gradient-brand border-transparent text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {ENABLE_GUIDES[k].label}
              </button>
            ))}
          </div>
          <ol className="space-y-3 text-sm">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          {guide.settingsUrl && (
            <p className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
              Shortcut: copy <code className="font-mono">{guide.settingsUrl}</code> into a new tab.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" asChild>
              <a href={guide.learnMore} target="_blank" rel="noreferrer">Learn more</a>
            </Button>
            <Button onClick={() => { setHelpOpen(false); void sync(true); }}>I've enabled it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function friendly(reason?: string, message?: string) {
  switch (reason) {
    case "no-config": return "Push isn't configured on the server yet. Your admin can finish setup in Diagnostics.";
    case "sw-failed": return "We couldn't start the background service. Please reload and try again.";
    case "token-failed": return message ?? "We couldn't register this device with the push service. Try again in a moment.";
    case "save-failed": return message ?? "We got a push token but couldn't save this device. Please try again.";
    default: return message ?? "Something went wrong turning on notifications.";
  }
}
