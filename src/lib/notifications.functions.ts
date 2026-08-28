import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------------- Diagnostics ----------------
export const getNotificationDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ count: deviceCount }, { data: settings }, { data: recentDeliveries }] = await Promise.all([
      supabase.from("fcm_tokens").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("notification_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("notification_deliveries")
        .select("channel, status, error, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
    ]);

    return {
      firebaseConfigured: !!process.env.FIREBASE_PROJECT_ID && !!process.env.FIREBASE_API_KEY,
      vapidConfigured: !!process.env.FIREBASE_VAPID_KEY,
      serviceAccountConfigured: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      emailConfigured: !!(process.env.LOVABLE_API_KEY && process.env.EMAIL_FROM_ADDRESS && process.env.EMAIL_SENDER_DOMAIN),
      smsConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      deviceCount: deviceCount ?? 0,
      scheduler: settings ? {
        enabled: settings.enabled,
        time: (settings.notify_time as string).slice(0, 5),
        timezone: settings.timezone,
        lastSent: settings.last_sent_date,
      } : null,
      recentDeliveries: recentDeliveries ?? [],
    };
  });

// ---------------- Send Test Notification ----------------
export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPushToUser, sendEmailNotification, sendSMSNotification } =
      await import("@/lib/notify-channels.server");

    const { data: profile } = await supabase
      .from("profiles").select("full_name, email, mobile").eq("id", userId).maybeSingle();
    const name = profile?.full_name || "Staff";
    const title = "AI Staff Assistant — Test";
    const body = `Hello ${name}, this is a test notification. If you can read this, delivery is working.`;

    const push = await sendPushToUser(supabaseAdmin as never, userId, title, body);
    const email = profile?.email
      ? await sendEmailNotification(profile.email, name, title, body)
      : { channel: "email" as const, status: "skipped" as const, error: "No email on profile" };
    const sms = profile?.mobile
      ? await sendSMSNotification(profile.mobile, title, body)
      : { channel: "sms" as const, status: "skipped" as const, error: "No mobile on profile" };

    // Log deliveries
    const rows = [...push, email, sms].map((r) => ({
      user_id: userId,
      channel: r.channel,
      status: r.status,
      target: r.target ?? null,
      error: r.error ?? null,
    }));
    if (rows.length) await supabaseAdmin.from("notification_deliveries").insert(rows);

    return { push, email, sms };
  });

// ---------------- Admin: list staff ----------------
export const adminListStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("profiles")
      .select("id, full_name, email, department, mobile").order("full_name");
    return { staff: data ?? [] };
  });

// ---------------- Admin: send notification ----------------
const SendSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(1000),
  target: z.enum(["all", "selected"]),
  target_user_ids: z.array(z.string().uuid()).default([]),
  scheduled_at: z.string().nullable().optional(),
  channels: z.object({
    push: z.boolean().default(true),
    email: z.boolean().default(false),
    sms: z.boolean().default(false),
  }),
});

export const adminSendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => SendSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPushToUser, sendEmailNotification, sendSMSNotification } =
      await import("@/lib/notify-channels.server");

    // Resolve recipients
    let userIds: string[] = [];
    if (data.target === "all") {
      const { data: rows } = await supabaseAdmin.from("profiles").select("id");
      userIds = (rows ?? []).map((r) => r.id);
    } else {
      userIds = data.target_user_ids;
    }

    // Insert admin_notifications row
    const scheduledAt = data.scheduled_at ? new Date(data.scheduled_at) : null;
    const isScheduled = scheduledAt && scheduledAt.getTime() > Date.now() + 30_000;
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("admin_notifications")
      .insert({
        created_by: context.userId,
        title: data.title,
        body: data.body,
        target: data.target,
        target_user_ids: userIds,
        scheduled_at: scheduledAt?.toISOString() ?? null,
        status: isScheduled ? "scheduled" : "pending",
        total_recipients: userIds.length,
      })
      .select("id").single();
    if (insErr) throw new Error(insErr.message);

    if (isScheduled) {
      return { id: inserted.id, scheduled: true, recipients: userIds.length };
    }

    // Immediate send
    let success = 0, failure = 0;
    const deliveries: Array<{ user_id: string; channel: string; status: string; target: string | null; error: string | null; admin_notification_id: string }> = [];
    for (const uid of userIds) {
      const { data: p } = await supabaseAdmin
        .from("profiles").select("full_name, email, mobile").eq("id", uid).maybeSingle();
      const name = p?.full_name || "Staff";

      if (data.channels.push) {
        const res = await sendPushToUser(supabaseAdmin as never, uid, data.title, data.body);
        for (const r of res) {
          deliveries.push({ user_id: uid, channel: r.channel, status: r.status, target: r.target ?? null, error: r.error ?? null, admin_notification_id: inserted.id });
          if (r.status === "success") success++; else if (r.status === "failed") failure++;
        }
      }
      if (data.channels.email && p?.email) {
        const r = await sendEmailNotification(p.email, name, data.title, data.body);
        deliveries.push({ user_id: uid, channel: r.channel, status: r.status, target: r.target ?? null, error: r.error ?? null, admin_notification_id: inserted.id });
        if (r.status === "success") success++; else if (r.status === "failed") failure++;
      }
      if (data.channels.sms && p?.mobile) {
        const r = await sendSMSNotification(p.mobile, data.title, data.body);
        deliveries.push({ user_id: uid, channel: r.channel, status: r.status, target: r.target ?? null, error: r.error ?? null, admin_notification_id: inserted.id });
        if (r.status === "success") success++; else if (r.status === "failed") failure++;
      }
    }
    if (deliveries.length) await supabaseAdmin.from("notification_deliveries").insert(deliveries);

    await supabaseAdmin.from("admin_notifications").update({
      status: failure > 0 && success === 0 ? "failed" : "sent",
      sent_at: new Date().toISOString(),
      success_count: success,
      failure_count: failure,
    }).eq("id", inserted.id);

    return { id: inserted.id, scheduled: false, recipients: userIds.length, success, failure };
  });

// ---------------- Admin: history ----------------
export const adminListNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("admin_notifications")
      .select("*").order("created_at", { ascending: false }).limit(50);
    return { notifications: data ?? [] };
  });

// ---------------- Check current user's role ----------------
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: !!data };
  });

// ---------------- Devices list (own) ----------------
export const getMyDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("fcm_tokens")
      .select("id, staff_name, email, browser, platform, device_id, last_active_at, created_at")
      .eq("user_id", context.userId)
      .order("last_active_at", { ascending: false });
    return { devices: data ?? [] };
  });

// ---------------- Delete a device ----------------
export const removeDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("fcm_tokens")
      .delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Register / refresh this device ----------------
const DeviceSchema = z.object({
  token: z.string().min(20),
  device_id: z.string().min(4),
  browser: z.string().max(40),
  platform: z.string().max(40),
  user_agent: z.string().max(500),
});

export const registerDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => DeviceSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
    const now = new Date().toISOString();

    const { error } = await supabase.from("fcm_tokens").upsert(
      {
        user_id: userId,
        device_id: data.device_id,
        token: data.token,
        staff_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        browser: data.browser,
        platform: data.platform,
        user_agent: data.user_agent,
        last_active_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,device_id" },
    );
    if (error) throw new Error(`Could not save this device: ${error.message}`);

    // Clean up any stale rows for the same device that kept an old token.
    await supabase.from("fcm_tokens")
      .delete().eq("user_id", userId).eq("device_id", data.device_id).neq("token", data.token);

    const { count } = await supabase
      .from("fcm_tokens").select("*", { count: "exact", head: true }).eq("user_id", userId);
    return { ok: true, deviceCount: count ?? 0 };
  });

// ---------------- Push-only test (real delivery, real errors) ----------------
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPushToUser } = await import("@/lib/notify-channels.server");
    const { data: profile } = await supabase
      .from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const title = "Test notification";
    const body = `Hello ${profile?.full_name || "Staff"} — push delivery is working on this device.`;

    const results = await sendPushToUser(supabaseAdmin as never, userId, title, body);
    await supabaseAdmin.from("notification_deliveries").insert(
      results.map((r) => ({
        user_id: userId, channel: r.channel, status: r.status,
        target: r.target ?? null, error: r.error ?? null, title, body,
      })),
    );
    const ok = results.some((r) => r.status === "success");
    const error = ok ? null : (results.find((r) => r.error)?.error ?? "No registered devices");
    return { ok, error, results };
  });
