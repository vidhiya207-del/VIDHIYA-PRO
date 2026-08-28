import { createFileRoute } from "@tanstack/react-router";

interface Parts { year: string; month: string; day: string; hour: string; minute: string; weekday: number }

function localParts(date: Date, tz: string): Parts | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
    });
    const p = fmt.formatToParts(date).reduce<Record<string, string>>((acc, x) => {
      if (x.type !== "literal") acc[x.type] = x.value; return acc;
    }, {});
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      year: p.year!, month: p.month!, day: p.day!,
      hour: p.hour === "24" ? "00" : p.hour!,
      minute: p.minute!,
      weekday: days.indexOf((p.weekday ?? "Sun").slice(0, 3)),
    };
  } catch { return null; }
}

function repeatMatches(rule: string, days: number[] | null, due: Parts, now: Parts): boolean {
  switch (rule) {
    case "daily": return true;
    case "weekdays": return now.weekday >= 1 && now.weekday <= 5;
    case "weekly": return now.weekday === due.weekday;
    case "monthly": return now.day === due.day;
    case "yearly": return now.day === due.day && now.month === due.month;
    case "custom": return (days ?? []).includes(now.weekday);
    case "none":
    default:
      return now.year === due.year && now.month === due.month && now.day === due.day;
  }
}

export const Route = createFileRoute("/api/public/hooks/daily-push")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { sendPushToUser, sendEmailNotification, sendSMSNotification } =
            await import("@/lib/notify-channels.server");

          const nowUtc = new Date();
          const nowIso = nowUtc.toISOString();
          let sent = 0, failed = 0;

          type DeliveryRow = {
            user_id: string; channel: string; status: string; target: string | null;
            error: string | null; title?: string | null; body?: string | null;
            reminder_id?: string | null; admin_notification_id?: string;
          };

          const profileCache = new Map<string, { full_name: string | null; email: string | null; mobile: string | null } | null>();
          const getProfile = async (uid: string) => {
            if (!profileCache.has(uid)) {
              const { data } = await supabaseAdmin.from("profiles")
                .select("full_name, email, mobile").eq("id", uid).maybeSingle();
              profileCache.set(uid, data ?? null);
            }
            return profileCache.get(uid) ?? null;
          };

          /** Smart delivery: push -> email -> sms, never silently fails. */
          const smartDeliver = async (
            uid: string, title: string, body: string, methods: string[], reminderId: string | null,
          ) => {
            const profile = await getProfile(uid);
            const name = profile?.full_name || "Staff";
            const rows: DeliveryRow[] = [];
            let delivered = false;

            const base = { user_id: uid, title, body, reminder_id: reminderId };

            if (methods.includes("push")) {
              const res = await sendPushToUser(supabaseAdmin as never, uid, title, body);
              for (const r of res) {
                rows.push({ ...base, channel: r.channel, status: r.status, target: r.target ?? null, error: r.error ?? null });
                if (r.status === "success") { delivered = true; sent++; } else if (r.status === "failed") failed++;
              }
            }

            const wantEmail = methods.includes("email") || !delivered;
            if (wantEmail && profile?.email) {
              const r = await sendEmailNotification(profile.email, name, title, body);
              rows.push({ ...base, channel: r.channel, status: r.status, target: r.target ?? null, error: r.error ?? null });
              if (r.status === "success") { delivered = true; sent++; } else if (r.status === "failed") failed++;
            }

            const wantSms = methods.includes("sms") || !delivered;
            if (wantSms && profile?.mobile) {
              const r = await sendSMSNotification(profile.mobile, title, body);
              rows.push({ ...base, channel: r.channel, status: r.status, target: r.target ?? null, error: r.error ?? null });
              if (r.status === "success") { delivered = true; sent++; } else if (r.status === "failed") failed++;
            }

            if (!rows.length) {
              rows.push({ ...base, channel: "push", status: "failed", target: null, error: "No delivery channel available" });
              failed++;
            }
            if (rows.length) await supabaseAdmin.from("notification_deliveries").insert(rows);
            return delivered;
          };

          // ---------- 1. Daily digest reminder (notification_settings) ----------
          const { data: settings } = await supabaseAdmin
            .from("notification_settings")
            .select("user_id, enabled, push_enabled, email_enabled, sms_enabled, notify_time, timezone, last_sent_date")
            .eq("enabled", true);

          let dailyProcessed = 0;
          for (const s of settings ?? []) {
            const now = localParts(nowUtc, s.timezone || "UTC");
            if (!now) continue;
            const localDate = `${now.year}-${now.month}-${now.day}`;
            if (`${now.hour}:${now.minute}` !== (s.notify_time as string).slice(0, 5)) continue;
            if (s.last_sent_date === localDate) continue;

            const profile = await getProfile(s.user_id);
            const name = profile?.full_name || "Staff";
            const methods = [
              s.push_enabled ? "push" : null,
              s.email_enabled ? "email" : null,
              s.sms_enabled ? "sms" : null,
            ].filter(Boolean) as string[];

            await smartDeliver(
              s.user_id,
              "AI Staff Assistant",
              `Hello ${name}, this is your scheduled reminder. Please upload today's lecture notes or complete your pending academic tasks.`,
              methods.length ? methods : ["push"],
              null,
            );
            dailyProcessed++;
            await supabaseAdmin.from("notification_settings")
              .update({ last_sent_date: localDate }).eq("user_id", s.user_id);
          }

          // ---------- 2. Individual smart reminders ----------
          const { data: reminders } = await supabaseAdmin
            .from("reminders")
            .select("id, user_id, title, description, subject, topic, reminder_type, repeat_rule, repeat_days, timezone, methods, due_date, is_completed, is_paused, is_archived, last_sent_date, sent_count")
            .eq("is_completed", false).eq("is_paused", false).eq("is_archived", false)
            .not("due_date", "is", null);

          let remindersProcessed = 0;
          for (const r of reminders ?? []) {
            const tz = r.timezone || "UTC";
            const now = localParts(nowUtc, tz);
            const due = localParts(new Date(r.due_date as string), tz);
            if (!now || !due) continue;
            const localDate = `${now.year}-${now.month}-${now.day}`;
            // Catch-up window: fire if the due minute is now or was within the last 5 minutes.
            const nowMin = Number(now.hour) * 60 + Number(now.minute);
            const dueMin = Number(due.hour) * 60 + Number(due.minute);
            const delta = nowMin - dueMin;
            if (delta < 0 || delta > 5) continue;
            if (r.last_sent_date === localDate) continue; // duplicate prevention
            if (!repeatMatches(r.repeat_rule, r.repeat_days, due, now)) continue;

            const detail = [r.subject, r.topic].filter(Boolean).join(" · ");
            const body = r.description || `${r.reminder_type}${detail ? ` — ${detail}` : ""}`;
            await smartDeliver(r.user_id, r.title, body, r.methods?.length ? r.methods : ["push"], r.id);
            remindersProcessed++;

            await supabaseAdmin.from("reminders").update({
              last_sent_at: nowIso,
              last_sent_date: localDate,
              sent_count: (r.sent_count ?? 0) + 1,
            }).eq("id", r.id);
          }

          // ---------- 3. Scheduled admin notifications ----------
          const { data: scheduled } = await supabaseAdmin
            .from("admin_notifications").select("*")
            .eq("status", "scheduled").lte("scheduled_at", nowIso);

          for (const n of scheduled ?? []) {
            let userIds: string[] = n.target_user_ids ?? [];
            if (n.target === "all") {
              const { data: rows } = await supabaseAdmin.from("profiles").select("id");
              userIds = (rows ?? []).map((x: { id: string }) => x.id);
            }
            let success = 0, failure = 0;
            for (const uid of userIds) {
              const ok = await smartDeliver(uid, n.title, n.body, ["push"], null);
              if (ok) success++; else failure++;
            }
            await supabaseAdmin.from("admin_notifications").update({
              status: failure > 0 && success === 0 ? "failed" : "sent",
              sent_at: nowIso, success_count: success, failure_count: failure,
            }).eq("id", n.id);
          }

          return Response.json({
            ok: true, dailyProcessed, remindersProcessed,
            scheduledProcessed: scheduled?.length ?? 0, sent, failed,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("daily-push error:", msg);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
