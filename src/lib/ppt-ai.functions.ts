import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { formatMathDeep } from "@/lib/math-format";

import { callAiGateway, AiUnavailableError, type AiPart } from "@/lib/ai-gateway";

type Part = AiPart;

async function callAI(system: string, parts: Part[]) {
  return callAiGateway(
    [
      { role: "system", content: system },
      { role: "user", content: parts },
    ],
    { json: true },
  );
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try { return formatMathDeep(JSON.parse(cleaned)) as T; } catch {
    const s = cleaned.indexOf("{"); const e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try { return formatMathDeep(JSON.parse(cleaned.slice(s, e + 1))) as T; } catch { /* fall through */ }
    }
    console.error("[ai] invalid JSON from model", cleaned.slice(0, 500));
    throw new AiUnavailableError();
  }
}


const SCHEMA = `{
  "title": string,               // deck title
  "subtitle": string,
  "slides": [
    {
      "layout": "title" | "section" | "bullets" | "two-column" | "table" | "chart" | "code" | "quote" | "process" | "stats" | "qa" | "summary",
      "title": string,
      "subtitle": string,        // optional
      "bullets": string[],       // 3-5 items, each 8-18 words (layout bullets/summary)
      "body": string,            // short paragraph (optional)
      "left":  { "heading": string, "bullets": string[] },   // two-column only
      "right": { "heading": string, "bullets": string[] },   // two-column only
      "table": { "headers": string[], "rows": string[][] },  // table only (<=5 cols, <=6 rows)
      "chart": { "type": "bar"|"line"|"pie", "labels": string[], "values": number[], "caption": string },
      "steps": string[],         // process/flowchart only, 3-6 steps
      "stats": [{ "value": string, "label": string }],       // stats only, 3-4 items
      "qa": [{ "q": string, "a": string }],                  // qa only, 3-5 items
      "code": string, "language": string,                    // code only
      "quote": string, "author": string,                     // quote only
      "notes": string            // speaker notes, 2-3 sentences
    }
  ]
}`;

export const generatePresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subject: z.string().trim().min(1).max(120),
      topic: z.string().trim().min(1).max(240),
      slideCount: z.number().int().min(6).max(30).default(14),
      audience: z.string().trim().max(60).default("College / Engineering"),
      language: z.enum(["english", "tamil", "bilingual"]).default("english"),
      depth: z.enum(["overview", "standard", "detailed"]).default("standard"),
      template: z.string().trim().max(30).default("professional"),
      sourceText: z.string().max(120000).optional(),
      images: z.array(z.string()).max(6).optional(),
      sources: z.array(z.object({ name: z.string(), kind: z.string() })).max(12).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const langRule =
      data.language === "tamil" ? "Write ALL slide content in Tamil (technical terms may stay in English)."
      : data.language === "bilingual" ? "Write each bullet in English followed by ' — ' and the Tamil translation."
      : "Write all content in clear academic English.";

    const system = `You are an elite presentation designer and subject-matter expert who builds decks of Gamma/Beautiful.ai quality for ${data.audience} audiences. Return ONLY valid JSON matching the given schema. Never leave a slide empty. Vary layouts across the deck — never use the same layout more than 3 times in a row. Keep every bullet punchy and information-dense.`;

    const parts: Part[] = [
      {
        type: "text",
        text: `Create a complete ${data.slideCount}-slide presentation.
Subject: ${data.subject}
Topic: ${data.topic}
Audience: ${data.audience}
Depth: ${data.depth}
${langRule}

CONTENT QUALITY REQUIREMENTS:
- Make every slide teach one clear idea with a specific, descriptive title. Never use vague titles such as "Overview" or "Important Points".
- Use simple academic language and define technical terms the first time they appear.
- Write 3-5 complete, non-repeating bullets per relevant slide. Each bullet must contain one meaningful idea, not a fragment or filler.
- Explain process steps, examples, tables, charts, and numbers with topic-specific content. Never use placeholders.
- Keep facts consistent across the deck. Do not invent sources or citations.
- If reference material is provided, follow its terminology, examples, and topic order exactly.

Deck structure (adapt to the topic, keep the count):
1 title, 1 objectives (bullets), 1 introduction, concept slides, at least one "two-column" comparison, one "table", one "chart" with realistic illustrative data, one "process" flowchart, one "stats", examples & real-world applications, advantages, disadvantages, one case study, one "code" slide if the topic is technical, one "qa" slide with interview / previous-year questions, a summary, and a references slide (layout "summary" with bullets of references).
Add clear speaker notes to every slide: two or three sentences that explain how to present it, not a repetition of its bullets.

JSON schema:
${SCHEMA}`,
      },
    ];

    if (data.sourceText?.trim()) {
      parts.push({
        type: "text",
        text: `PRIMARY REFERENCE MATERIAL (uploaded by the user — base the deck on this, follow its syllabus, terminology and order):\n${data.sourceText.slice(0, 100000)}`,
      });
    }
    for (const img of data.images ?? []) parts.push({ type: "image_url", image_url: { url: img } });

    const raw = await callAI(system, parts);
    const parsed = parseJson<{ title?: string; subtitle?: string; slides?: unknown[] }>(raw);
    const slides = (parsed.slides ?? []).map((s, i) => ({
      ...(s as object),
      id: `${Date.now().toString(36)}${i}`,
    }));
    if (!slides.length) throw new AiUnavailableError();

    const { data: row, error } = await context.supabase
      .from("ppts")
      .insert({
        user_id: context.userId,
        subject: data.subject,
        topic: parsed.title?.trim() || data.topic,
        template: data.template,
        slides: slides as never,
        settings: { animations: true, animation: "fade" } as never,
        sources: (data.sources ?? []) as never,
      })
      .select("id")
      .single();
    if (error) { console.error("[db] insert failed", error); throw new Error("Could not save your work. Please try again."); }
    return { id: row!.id as string };
  });

export const generateSlide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subject: z.string().trim().max(120),
      topic: z.string().trim().max(240),
      instruction: z.string().trim().min(1).max(500),
      layout: z.string().trim().max(20).default("bullets"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const raw = await callAI(
      "You design a single professional presentation slide. Return ONLY JSON for one slide object.",
      [{
        type: "text",
        text: `Deck: ${data.subject} — ${data.topic}
Requested slide: ${data.instruction}
Preferred layout: ${data.layout}

Return JSON: { "slide": <one slide object> } using this slide schema:
${SCHEMA}`,
      }],
    );
    const parsed = parseJson<{ slide?: Record<string, unknown> }>(raw);
    if (!parsed.slide) throw new AiUnavailableError();
    return { slide: { ...parsed.slide, id: Date.now().toString(36) } };
  });
