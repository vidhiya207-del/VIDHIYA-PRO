// Client-side safety net: never surface provider/billing/internal wording.
const AI_UNAVAILABLE = "The AI service is temporarily busy. Please try again in a few minutes.";

const BLOCKED =
  /(credit|billing|payment|402|401|429|rate.?limit|api[\s_-]?key|token|workspace|quota|gateway|provider|openai|gemini|google|firebase|supabase|upstream|unauthorized|internal server|fetch failed|status \d{3})/i;

export function userMessage(err: unknown, fallback = AI_UNAVAILABLE): string {
  // Full detail stays in the developer console only.
  console.error("[error]", err);
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const msg = raw.trim();
  if (!msg || msg.length > 180 || BLOCKED.test(msg)) return fallback;
  return msg;
}

export { AI_UNAVAILABLE };
