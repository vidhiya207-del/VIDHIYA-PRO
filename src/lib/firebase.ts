import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getMessaging, getToken, deleteToken, onMessage, isSupported, type Messaging,
} from "firebase/messaging";
import { getFirebaseWebConfig } from "./firebase-config.functions";
import { registerDevice } from "./notifications.functions";

let cachedApp: FirebaseApp | null = null;
let cachedMessaging: Messaging | null = null;
let cachedConfig: Awaited<ReturnType<typeof getFirebaseWebConfig>> | null = null;
let foregroundBound = false;

const SW_PATH = "/firebase-messaging-sw.js";

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Edg/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  return "Unknown";
}

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Win/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

function getOrCreateDeviceId(): string {
  const KEY = "staffmate_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

/** Never let a hanging browser API freeze the UI. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
  ]);
}

async function ensureApp() {
  if (cachedApp && cachedConfig) return { app: cachedApp, config: cachedConfig };
  const config = await getFirebaseWebConfig();
  cachedConfig = config;
  if (!config.projectId) throw new Error("Push is not configured yet (missing Firebase project)");
  if (!config.apiKey) throw new Error("Push is not configured yet (missing Firebase API key)");
  cachedApp = getApps().length ? getApp() : initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });
  return { app: cachedApp, config };
}

export async function getFCMConfig() {
  const { config } = await ensureApp();
  return config;
}

async function registerSW(config: { apiKey: string; projectId: string; messagingSenderId: string; appId: string }) {
  if (!("serviceWorker" in navigator)) throw new Error("Service workers are not supported in this browser");
  const params = new URLSearchParams({
    apiKey: config.apiKey,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });
  const swUrl = `${SW_PATH}?${params.toString()}`;

  // Reuse an existing messaging worker when it already points at the same config.
  const existing = await navigator.serviceWorker.getRegistrations();
  for (const reg of existing) {
    const url = reg.active?.scriptURL ?? reg.installing?.scriptURL ?? reg.waiting?.scriptURL ?? "";
    if (url.includes("firebase-messaging-sw.js")) {
      if (url.includes(`projectId=${config.projectId}`)) {
        await reg.update().catch(() => undefined);
        await withTimeout(navigator.serviceWorker.ready, 15_000, "Service worker activation");
        return reg;
      }
      // Stale config — drop it so a fresh one can install.
      await reg.unregister().catch(() => undefined);
    }
  }

  const reg = await withTimeout(
    navigator.serviceWorker.register(swUrl, { scope: "/" }),
    15_000,
    "Service worker registration",
  );
  await withTimeout(navigator.serviceWorker.ready, 15_000, "Service worker activation");
  return reg;
}

export interface FCMRegisterResult {
  ok: boolean;
  token?: string;
  reason?: "unsupported" | "denied" | "no-config" | "sw-failed" | "token-failed" | "save-failed" | "error";
  message?: string;
  deviceCount?: number;
  diagnostics: {
    firebaseInitialized: boolean;
    swRegistered: boolean;
    permission: NotificationPermission | "unsupported";
    hasVapidKey: boolean;
    tokenGenerated: boolean;
    deviceSaved: boolean;
    lastError?: string;
  };
}

export async function requestAndRegisterFCM(): Promise<FCMRegisterResult> {
  const diag: FCMRegisterResult["diagnostics"] = {
    firebaseInitialized: false,
    swRegistered: false,
    permission: currentPermission(),
    hasVapidKey: false,
    tokenGenerated: false,
    deviceSaved: false,
  };

  try {
    if (typeof window === "undefined") return { ok: false, reason: "unsupported", diagnostics: diag };
    if (!(await isSupported())) {
      diag.lastError = "This browser does not support web push notifications";
      return { ok: false, reason: "unsupported", message: diag.lastError, diagnostics: diag };
    }

    let app: FirebaseApp;
    let config: Awaited<ReturnType<typeof getFirebaseWebConfig>>;
    try {
      const r = await ensureApp();
      app = r.app; config = r.config;
      diag.firebaseInitialized = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      diag.lastError = msg;
      console.error("[FCM] Firebase init failed:", msg);
      return { ok: false, reason: "no-config", message: msg, diagnostics: diag };
    }

    diag.hasVapidKey = !!config.vapidKey;
    if (!config.vapidKey) {
      diag.lastError = "Push is not configured yet (missing web push key)";
      console.error("[FCM]", diag.lastError);
      return { ok: false, reason: "no-config", message: diag.lastError, diagnostics: diag };
    }

    const permission = await Notification.requestPermission();
    diag.permission = permission;
    if (permission !== "granted") {
      diag.lastError = permission === "denied"
        ? "Notifications are blocked for this site"
        : "Notification permission was dismissed";
      return { ok: false, reason: "denied", message: diag.lastError, diagnostics: diag };
    }

    let reg: ServiceWorkerRegistration;
    try {
      reg = await registerSW(config);
      diag.swRegistered = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      diag.lastError = `Service worker failed: ${msg}`;
      console.error("[FCM]", diag.lastError);
      return { ok: false, reason: "sw-failed", message: diag.lastError, diagnostics: diag };
    }

    cachedMessaging ??= getMessaging(app);

    // Attempt 1, then force a fresh token if the cached one is stale/expired.
    let token = "";
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        token = await withTimeout(
          getToken(cachedMessaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: reg }),
          20_000,
          "Push token request",
        );
        if (token) break;
        lastError = "Firebase returned an empty push token";
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error(`[FCM] getToken attempt ${attempt + 1} failed:`, lastError);
      }
      // Clear any stale registration before retrying.
      try { await deleteToken(cachedMessaging); } catch { /* nothing to delete */ }
      await new Promise((r) => setTimeout(r, 800));
    }

    if (!token) {
      diag.lastError = `Could not get a push token: ${lastError}`;
      return { ok: false, reason: "token-failed", message: diag.lastError, diagnostics: diag };
    }
    diag.tokenGenerated = true;

    let deviceCount = 0;
    try {
      const res = await registerDevice({
        data: {
          token,
          device_id: getOrCreateDeviceId(),
          browser: detectBrowser(),
          platform: detectPlatform(),
          user_agent: navigator.userAgent.slice(0, 500),
        },
      });
      deviceCount = res.deviceCount;
      diag.deviceSaved = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      diag.lastError = `Device could not be saved: ${msg}`;
      console.error("[FCM]", diag.lastError);
      return { ok: false, reason: "save-failed", message: diag.lastError, diagnostics: diag };
    }

    if (!foregroundBound) {
      foregroundBound = true;
      onMessage(cachedMessaging, (payload) => {
        const title = payload.notification?.title ?? "AI Staff Assistant";
        const body = payload.notification?.body ?? "";
        try {
          void reg.showNotification(title, { body, icon: "/favicon.ico", badge: "/favicon.ico" });
        } catch {
          try { new Notification(title, { body, icon: "/favicon.ico" }); } catch { /* ignore */ }
        }
      });
    }

    return { ok: true, token, deviceCount, diagnostics: diag };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    diag.lastError = msg;
    console.error("[FCM] Unexpected error:", e);
    return { ok: false, reason: "error", message: msg, diagnostics: diag };
  }
}

export function currentPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function isSWRegistered(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.some((r) => (r.active?.scriptURL ?? "").includes("firebase-messaging-sw.js"));
}
