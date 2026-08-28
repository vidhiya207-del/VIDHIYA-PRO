export type BrowserKey =
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "android-chrome"
  | "ios-safari"
  | "other";

export interface EnableGuide {
  label: string;
  steps: string[];
  learnMore: string;
  settingsUrl?: string;
}

export function detectBrowserKey(): BrowserKey {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  if (isIOS) return "ios-safari";
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return isAndroid ? "android-chrome" : "chrome";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "safari";
  return "other";
}

export const ENABLE_GUIDES: Record<BrowserKey, EnableGuide> = {
  chrome: {
    label: "Google Chrome (Desktop)",
    steps: [
      "Click the lock / tune icon at the left of the address bar.",
      "Open “Site settings”.",
      "Set “Notifications” to Allow.",
      "Return here — the page detects the change automatically.",
    ],
    learnMore: "https://support.google.com/chrome/answer/3220216",
    settingsUrl: "chrome://settings/content/notifications",
  },
  edge: {
    label: "Microsoft Edge",
    steps: [
      "Click the lock icon at the left of the address bar.",
      "Choose “Permissions for this site”.",
      "Set “Notifications” to Allow.",
      "Come back to this page — no reload needed.",
    ],
    learnMore: "https://support.microsoft.com/en-us/microsoft-edge",
    settingsUrl: "edge://settings/content/notifications",
  },
  firefox: {
    label: "Mozilla Firefox",
    steps: [
      "Click the lock icon in the address bar.",
      "Find the blocked “Send Notifications” entry.",
      "Click the ✕ / “Clear” next to it to reset the permission.",
      "Press “Allow Notifications” here again.",
    ],
    learnMore: "https://support.mozilla.org/kb/push-notifications-firefox",
    settingsUrl: "about:preferences#privacy",
  },
  safari: {
    label: "Safari (macOS)",
    steps: [
      "Open Safari → Settings → Websites → Notifications.",
      "Find this site in the list and choose Allow.",
      "Make sure macOS System Settings → Notifications → Safari is enabled.",
      "Return to this tab.",
    ],
    learnMore: "https://support.apple.com/guide/safari/manage-website-notifications-sfri40734/mac",
  },
  "android-chrome": {
    label: "Android (Chrome / Edge / Firefox)",
    steps: [
      "Tap the ⋮ menu → Settings → Site settings → Notifications.",
      "Find this site and switch it to Allowed.",
      "Also check Android Settings → Apps → your browser → Notifications is on.",
      "Return to this tab.",
    ],
    learnMore: "https://support.google.com/chrome/answer/3220216?co=GENIE.Platform%3DAndroid",
  },
  "ios-safari": {
    label: "iPhone / iPad (Safari)",
    steps: [
      "Web push on iOS requires iOS 16.4 or newer.",
      "Tap the Share button → “Add to Home Screen” to install this app.",
      "Open the app from your Home Screen (not the Safari tab).",
      "Tap “Allow Notifications” inside the installed app.",
    ],
    learnMore: "https://support.apple.com/guide/iphone/notifications-iph7c3d96bab/ios",
  },
  other: {
    label: "Your browser",
    steps: [
      "Open your browser's site settings for this page.",
      "Allow notifications for this site.",
      "Return here — the change is detected automatically.",
    ],
    learnMore: "https://developer.mozilla.org/docs/Web/API/Notifications_API",
  },
};

export function getEnableGuide(): EnableGuide {
  return ENABLE_GUIDES[detectBrowserKey()];
}
