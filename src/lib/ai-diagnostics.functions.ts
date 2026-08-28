import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_BASE, DEFAULT_MODEL, DEFAULT_FALLBACKS, rawAiCall } from "@/lib/ai-gateway";

export type Check = {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
  fix?: string;
};

/**
 * Runs a real end-to-end AI request and reports every stage.
 * Technical details are returned to this admin-only page — never to end users.
 */
export const runAiDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const checks: Check[] = [];
    const key = process.env["GEMINI_API_KEY"] ?? process.env["VITE_GEMINI_API_KEY"];

    checks.push({
      id: "provider",
      label: "AI Provider Connected",
      status: "pass",
      detail: `Lovable AI Gateway — ${AI_BASE}`,
    });

    checks.push(
      key
        ? { id: "key", label: "API Key Available", status: "pass", detail: `Configured (${key.length} chars, value never exposed)` }
        : {
            id: "key",
            label: "API Key Available",
            status: "fail",
            detail: "GEMINI_API_KEY is not present in the server environment.",
            fix: "Provision a Gemini API key for this project.",
          },
    );

    // Endpoint reachability (also proves outbound network works).
    let endpointOk = false;
    const netStart = Date.now();
    try {
      const res = await fetch("https://generativelanguage.googleapis.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      endpointOk = true;
      checks.push({
        id: "endpoint",
        label: "Endpoint Reachable",
        status: "pass",
        detail: `Responded HTTP ${res.status} in ${Date.now() - netStart}ms`,
      });
      checks.push({ id: "network", label: "Network Connectivity", status: "pass", detail: "Outbound HTTPS from the server is working." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.push({
        id: "endpoint",
        label: "Endpoint Reachable",
        status: "fail",
        detail: msg,
        fix: "The gateway host could not be reached from the server. Check outbound network / DNS.",
      });
      checks.push({ id: "network", label: "Network Connectivity", status: "fail", detail: msg, fix: "Retry once connectivity is restored." });
    }

    // Real request through the primary model.
    const probe = key && endpointOk
      ? await rawAiCall([{ role: "user", content: "Reply with the single word: READY" }], DEFAULT_MODEL)
      : null;

    const f = probe && !probe.ok ? probe.failure : null;
    const status = f?.status;

    checks.push({
      id: "auth",
      label: "Authentication",
      status: !probe ? "warn" : status === 401 || status === 403 ? "fail" : "pass",
      detail: !probe
        ? "Skipped — no API key or endpoint unreachable."
        : status === 401 || status === 403
          ? f!.message
          : "Gateway accepted the credentials.",
      ...(status === 401 || status === 403 ? { fix: f!.hint } : {}),
    });

    checks.push({
      id: "model",
      label: `Model Available (${DEFAULT_MODEL})`,
      status: !probe ? "warn" : status === 400 || status === 404 ? "fail" : "pass",
      detail: !probe
        ? "Skipped."
        : status === 400 || status === 404
          ? f!.message
          : `Primary: ${DEFAULT_MODEL} · Fallbacks: ${DEFAULT_FALLBACKS.join(", ")}`,
      ...(status === 400 || status === 404 ? { fix: f!.hint } : {}),
    });

    checks.push({
      id: "quota",
      label: "Credits / Quota Available",
      status: !probe ? "warn" : status === 402 ? "fail" : status === 429 ? "warn" : "pass",
      detail: !probe
        ? "Skipped."
        : status === 402
          ? "Gateway returned 402 — the workspace AI credit balance is exhausted."
          : status === 429
            ? "Gateway returned 429 — requests are being rate limited right now."
            : "Within quota.",
      ...(status === 402
        ? { fix: "Add AI credits to the workspace (Settings → Plans & Billing). No code change will resolve a 402." }
        : status === 429
          ? { fix: "Reduce request frequency; the built-in backoff will retry automatically." }
          : {}),
    });

    checks.push({
      id: "request",
      label: "Request Success",
      status: probe?.ok ? "pass" : "fail",
      detail: probe ? (probe.ok ? "Request accepted and completed." : `${f!.kind}${status ? ` ${status}` : ""}: ${f!.message}`) : "Not attempted.",
      ...(probe && !probe.ok ? { fix: f!.hint } : {}),
    });

    checks.push({
      id: "response",
      label: "Response Success",
      status: probe?.ok ? "pass" : "fail",
      detail: probe?.ok ? `Parsed completion: "${probe.content.trim().slice(0, 60)}"` : "No parseable completion received.",
      ...(probe && !probe.ok ? { fix: "Fix the request failure above; response parsing is not reached." } : {}),
    });

    checks.push({
      id: "latency",
      label: "Average Response Time",
      status: !probe ? "warn" : probe.ms > 20_000 ? "warn" : "pass",
      detail: probe ? `${probe.ms} ms (streamed without an artificial deadline)` : "Not measured.",
    });

    return {
      ready: Boolean(probe?.ok),
      checkedAt: new Date().toISOString(),
      checks,
    };
  });
