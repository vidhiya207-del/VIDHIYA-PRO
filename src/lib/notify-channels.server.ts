// Server-only helpers for sending notifications through all channels.
// Loaded only inside server-function handlers.
import { sendFCMToToken } from "./fcm-send.server";

export interface ChannelResult {
  channel: "push" | "email" | "sms";
  status: "success" | "failed" | "skipped";
  target?: string;
  error?: string;
}

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** Convert common Indian/local input into the E.164 format required by SMS APIs. */
function normalizePhone(value: string): string | null {
  let phone = value.trim().replace(/[\s().-]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (!phone.startsWith("+")) {
    if (/^\d{10}$/.test(phone)) phone = `+91${phone}`;
    else phone = `+${phone}`;
  }
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

/**
 * Send an email via Lovable managed emails. Returns skipped if not configured.
 */
export async function sendEmailNotification(
  toEmail: string,
  staffName: string,
  title: string,
  body: string,
): Promise<ChannelResult> {
  const email = normalizeEmail(toEmail);
  if (!email) return { channel: "email", status: "skipped", error: "Add a valid email address to your profile." };
  const apiKey = process.env.LOVABLE_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const senderDomain = process.env.EMAIL_SENDER_DOMAIN;
  if (!apiKey || !fromAddress || !senderDomain) {
    return {
      channel: "email", status: "skipped", target: email,
      error: "Email not configured. Set up an email domain (Cloud → Emails) and add EMAIL_FROM_ADDRESS and EMAIL_SENDER_DOMAIN.",
    };
  }
  try {
    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const safeTitle = escapeHtml(title);
    const safeBody = escapeHtml(body).replace(/\n/g, "<br/>");
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#ffffff;color:#111;padding:24px">
      <h2 style="margin:0 0 12px">${safeTitle}</h2>
      <p>Hello ${escapeHtml(staffName || "Staff")},</p>
      <p>${safeBody}</p>
      <p style="color:#666;font-size:12px;margin-top:24px">— AI Staff Assistant</p>
    </body></html>`;
    const text = `Hello ${staffName || "Staff"},\n\n${body}\n\n— AI Staff Assistant`;
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await sendLovableEmail(
          { to: email, from: fromAddress, sender_domain: senderDomain, subject: title, html, text },
          { apiKey },
        );
        return { channel: "email", status: "success", target: email };
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        if (/suppressed|domain_not_verified|emails_disabled|401|403/i.test(lastError)) break;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    return { channel: "email", status: "failed", target: email, error: lastError };
  } catch (e) {
    return {
      channel: "email", status: "skipped", target: email,
      error: `Email sender unavailable: ${e instanceof Error ? e.message : String(e)}. Configure an email domain in the Cloud → Emails section.`,
    };
  }
}

/**
 * Send SMS via Twilio if configured, else skipped with helpful message.
 */
export async function sendSMSNotification(
  toPhone: string,
  title: string,
  body: string,
): Promise<ChannelResult> {
  const phone = normalizePhone(toPhone);
  if (!phone) return { channel: "sms", status: "skipped", error: "Add a valid mobile number (for example, +91 98765 43210) to your profile." };
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return {
      channel: "sms", status: "skipped", target: phone,
      error: "SMS not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to enable SMS.",
    };
  }
  const auth = btoa(`${sid}:${token}`);
  const message = `${title}\n\n${body}`;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: phone, Body: message }),
      });
      if (resp.ok) return { channel: "sms", status: "success", target: phone };
      lastError = `Twilio [${resp.status}]: ${await resp.text()}`;
      // Bad request / auth errors — no retry
      if (resp.status === 400 || resp.status === 401 || resp.status === 403) break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  return { channel: "sms", status: "failed", target: phone, error: lastError };
}

export async function sendPushToUser(
  supabaseAdmin: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => Promise<{ data: { token: string }[] | null }>;
      };
      delete: () => { eq: (col: string, v: string) => Promise<unknown> };
    };
  },
  userId: string,
  title: string,
  body: string,
): Promise<ChannelResult[]> {
  const { data: tokens } = await supabaseAdmin.from("fcm_tokens").select("token").eq("user_id", userId);
  if (!tokens || tokens.length === 0) {
    return [{ channel: "push", status: "skipped", error: "No registered devices" }];
  }
  const out: ChannelResult[] = [];
  for (const t of tokens) {
    const res = await sendFCMToToken(t.token, title, body);
    if (res.ok) {
      out.push({ channel: "push", status: "success", target: t.token.slice(0, 12) + "…" });
    } else {
      out.push({ channel: "push", status: "failed", target: t.token.slice(0, 12) + "…", error: res.error });
      if (res.status === 404 || res.status === 400) {
        await supabaseAdmin.from("fcm_tokens").delete().eq("token", t.token);
      }
    }
  }
  return out;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
