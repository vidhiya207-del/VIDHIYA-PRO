export const AI_BASE = "https://ai.gateway.lovable.dev/v1";

export const AI_UNAVAILABLE =
  "AI generation is temporarily unavailable right now. Please try again in a few minutes.";

export class AiUnavailableError extends Error {
  constructor() {
    super(AI_UNAVAILABLE);
    this.name = "AiUnavailableError";
  }
}

export type AiPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type AiMessage =
  | { role: "system"; content: string }
  | { role: "assistant"; content: string }
  | { role: "user"; content: string | AiPart[] };

type Options = {
  model?: string;
  fallbackModels?: string[];
  json?: boolean;
  attempts?: number;
  maxTokens?: number;
};

export const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct";
export const DEFAULT_FALLBACKS: string[] = ["@cf/meta/llama-3.1-8b-instruct-fast"];

export const SUPPORTED_MODELS = new Set([
  DEFAULT_MODEL,
  ...DEFAULT_FALLBACKS,
]);

export type AiProviderId = "cloudflare";

export type AiFailure = {
  kind: "config" | "http" | "network" | "empty";
  status?: number;
  provider?: string;
  model?: string;
  message: string;
  hint: string;
  retryAfterSeconds?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function logInternal(scope: string, detail: unknown) {
  console.error(`[ai-gateway] ${scope}`, detail);
}

function failureHint(status: number | undefined): string {
  if (status === 400) return "Correct the request fields, schema, or input size before retrying.";
  if (status === 401 || status === 403) return "Provision a valid Cloudflare API token.";
  if (status === 429) return "The provider rate limit was reached; retrying automatically may help.";
  if (status && status >= 500) return "The provider failed temporarily; retry with bounded backoff.";
  return "The server could not complete the AI request.";
}

function promptFromMessages(messages: AiMessage[], json?: boolean): string {
  const parts = messages.map((message) => {
    const content = typeof message.content === "string"
      ? message.content
      : message.content
          .map((part) => part.type === "text" ? part.text : "[An image was attached; describe and use its relevant content.]")
          .join("\n");
    return `${message.role.toUpperCase()}: ${content}`;
  });
  if (json) parts.push("Return strictly valid JSON only, with no Markdown fence or explanation.");
  return parts.join("\n\n");
}

function retryDelay(response: Response | undefined, retry: number): number {
  const retryAfter = response?.headers.get("retry-after");
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 8_000);
  return 400 * 2 ** retry;
}

export async function rawAiCall(
  messages: AiMessage[],
  model = DEFAULT_MODEL,
  opts: Pick<Options, "json" | "maxTokens" | "attempts"> = {},
  _providerId: AiProviderId = "cloudflare",
): Promise<{ ok: true; content: string; ms: number; provider: string; truncated: boolean } | { ok: false; failure: AiFailure; ms: number }> {
  const started = Date.now();
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!token || !accountId) {
    return { ok: false, ms: 0, failure: { kind: "config", provider: "cloudflare", model, message: "CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID not configured.", hint: "Add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to server secrets." } };
  }

  const attempts = Math.max(1, Math.min(opts.attempts ?? 3, 3));
  let lastFailure: AiFailure | undefined;

  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response | undefined;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180_000);
      try {
        response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            messages: [{ role: "user", content: promptFromMessages(messages, opts.json) }],
            max_tokens: opts.maxTokens,
            ...(opts.json ? { response_format: { type: "json" } } : {}),
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        const content = body.result?.response ?? "";
        if (content.trim()) {
          return {
            ok: true,
            content,
            ms: Date.now() - started,
            provider: "cloudflare",
            truncated: false,
          };
        }
        lastFailure = { kind: "empty", provider: "cloudflare", model, message: "Model output was empty.", hint: "Retry with a simpler prompt." };
      } else {
        lastFailure = { kind: "http", status: response.status, provider: "cloudflare", model, message: body.errors?.[0]?.message || `Cloudflare AI returned HTTP ${response.status}.`, hint: failureHint(response.status) };
      }
    } catch (error) {
      lastFailure = { kind: "network", provider: "cloudflare", model, message: error instanceof Error ? error.message : "Network request failed.", hint: "Check network connectivity and retry." };
    }

    const retryable = lastFailure.kind === "network" || lastFailure.kind === "empty" || lastFailure.status === 429 || Boolean(lastFailure.status && lastFailure.status >= 500);
    if (!retryable || attempt === attempts - 1) break;
    await sleep(retryDelay(response, attempt));
  }

  return { ok: false, ms: Date.now() - started, failure: lastFailure! };
}

export async function callAiGateway(messages: AiMessage[], opts: Options = {}): Promise<string> {
  const requested = [opts.model ?? DEFAULT_MODEL, ...(opts.fallbackModels ?? DEFAULT_FALLBACKS)]
    .filter((model, index, models) => models.indexOf(model) === index && SUPPORTED_MODELS.has(model));
  const models = requested.length ? requested : [DEFAULT_MODEL, ...DEFAULT_FALLBACKS];
  let lastFailure: AiFailure | undefined;

  for (const model of models) {
    let requestMessages = messages;
    let content = "";

    for (let segment = 0; segment < 3; segment++) {
      const result = await rawAiCall(requestMessages, model, opts);
      if (!result.ok) {
        lastFailure = result.failure;
        break;
      }

      content += result.content;
      if (!result.truncated) return content;

      requestMessages = [
        ...requestMessages,
        { role: "assistant", content: result.content },
        {
          role: "user",
          content: "Continue exactly from where your previous response stopped. Do not repeat any text, headings, or opening tags. Complete every remaining requested section and finish the HTML fragment with all tags closed.",
        },
      ];
    }

    if (content) return content;
    if (lastFailure && ([400, 401, 403].includes(lastFailure.status ?? 0) || lastFailure.kind === "config")) break;
    if (lastFailure) logInternal("model-failed", lastFailure);
  }

  logInternal("generation-failed", lastFailure);
  throw new AiUnavailableError();
}

export function toUserFacingAiError(error: unknown): Error {
  if (error instanceof AiUnavailableError) return error;
  logInternal("handler-error", error);
  return new AiUnavailableError();
}
