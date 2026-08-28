import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { formatMathDeep } from "@/lib/math-format";

import { callAiGateway, AiUnavailableError } from "@/lib/ai-gateway";

async function callAI(system: string, user: string, opts?: { json?: boolean }) {
  return callAiGateway(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { model: "google/gemini-3.6-flash", json: opts?.json },
  );
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try { return formatMathDeep(JSON.parse(cleaned)) as T; }
  catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return formatMathDeep(JSON.parse(cleaned.slice(start, end + 1))) as T; } catch { /* fall through */ }
    }
    console.error("[ai] invalid JSON from model", cleaned.slice(0, 500));
    throw new AiUnavailableError();
  }

}

/* -------------------- Notes -------------------- */

export const generateNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subject: z.string().trim().min(1).max(100),
      topic: z.string().trim().min(1).max(200),
      department: z.string().trim().max(80).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { subject, topic, department } = data;
    const system = `You are an expert college professor. Produce comprehensive, exam-ready teaching notes as strict JSON. Do not include commentary. All fields must be present. Use plain text (no markdown symbols) inside string values, but allow \\n newlines. For code, use language-tagged code blocks inside the "programs" field.`;
    const user = `Generate detailed notes for:
Subject: ${subject}
Topic: ${topic}
Department: ${department ?? "General"}

Return JSON with this exact schema:
{
  "introduction": string,
  "definition": string,
  "real_world_example": string,
  "simple_explanation": string,
  "detailed_explanation": string,
  "diagram_description": string,
  "flowchart_steps": string[],
  "syntax": string,
  "programs": [{ "language": string, "title": string, "code": string, "line_by_line": string, "output": string }],
  "advantages": string[],
  "disadvantages": string[],
  "applications": string[],
  "important_questions": string[],
  "mcqs": [{ "question": string, "options": string[], "answer": string, "explanation": string }],
  "short_questions": string[],
  "long_questions": string[],
  "summary": string,
  "key_points": string[]
}

Provide 3-5 programs when the topic is a programming concept, otherwise programs=[]. Provide at least 5 MCQs, 5 short and 3 long questions.`;
    const raw = await callAI(system, user, { json: true });
    const content = parseJson<Record<string, unknown>>(raw);
    const { data: row, error } = await context.supabase
      .from("notes")
      .insert({
        user_id: context.userId,
        subject, topic, department: department ?? null,
        content: content as never,
      })
      .select("id")
      .single();
    if (error) { console.error("[db] insert failed", error); throw new Error("Could not save your work. Please try again."); }
    return { id: row!.id as string };
  });

/* -------------------- PPT -------------------- */

export const generatePPT = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subject: z.string().trim().min(1).max(100),
      topic: z.string().trim().min(1).max(200),
      slideCount: z.number().int().min(6).max(20).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const count = data.slideCount ?? 12;
    const system = `You are a presentation designer. Return only JSON.`;
    const user = `Create a professional ${count}-slide lecture presentation.
Subject: ${data.subject}
Topic: ${data.topic}

JSON schema:
{
  "slides": [
    { "type": "title" | "content" | "bullets" | "code" | "summary",
      "title": string,
      "subtitle": string,
      "bullets": string[],
      "body": string,
      "code": string,
      "notes": string
    }
  ]
}
Slide 1 = title, last = summary/references. Include an Objectives slide, Concept, Examples, Applications, and at least one code slide if programming.`;
    const raw = await callAI(system, user, { json: true });
    const parsed = parseJson<{ slides: unknown[] }>(raw);
    const { data: row, error } = await context.supabase
      .from("ppts")
      .insert({
        user_id: context.userId,
        subject: data.subject, topic: data.topic,
        slides: parsed.slides as never,
      })
      .select("id")
      .single();
    if (error) { console.error("[db] insert failed", error); throw new Error("Could not save your work. Please try again."); }
    return { id: row!.id as string };
  });

/* -------------------- Question Paper -------------------- */

export const generateQuestionPaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subject: z.string().trim().min(1).max(100),
      department: z.string().trim().max(80).optional(),
      unit: z.string().trim().max(50).optional(),
      totalMarks: z.number().int().min(10).max(200),
      difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
      pattern: z.string().trim().max(200).optional(),
      title: z.string().trim().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const system = "You are a university examiner. Return only JSON.";
    const user = `Design a ${data.totalMarks}-mark question paper.
Subject: ${data.subject}
Unit: ${data.unit ?? "All units"}
Difficulty: ${data.difficulty}
Pattern: ${data.pattern ?? "Standard: Part A (2 marks x 10), Part B (5 marks), Part C (10-15 marks)"}

JSON schema:
{
  "header": { "college": string, "subject": string, "duration": string, "max_marks": number, "instructions": string[] },
  "parts": [
    { "name": string, "marks_each": number, "count": number, "questions": [
      { "q_no": string, "question": string, "marks": number, "bloom_level": string, "answer_hint": string }
    ]}
  ]
}`;
    const raw = await callAI(system, user, { json: true });
    const content = parseJson<Record<string, unknown>>(raw);
    const { data: row, error } = await context.supabase
      .from("question_papers")
      .insert({
        user_id: context.userId,
        title: data.title ?? `${data.subject} — ${data.unit ?? "Full"}`,
        department: data.department ?? null,
        subject: data.subject,
        unit: data.unit ?? null,
        total_marks: data.totalMarks,
        difficulty: data.difficulty,
        pattern: data.pattern ?? null,
        content: content as never,
      })
      .select("id")
      .single();
    if (error) { console.error("[db] insert failed", error); throw new Error("Could not save your work. Please try again."); }
    return { id: row!.id as string };
  });

/* -------------------- Question Bank -------------------- */

export const generateQuestionBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subject: z.string().trim().min(1).max(100),
      topic: z.string().trim().min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const system = "You are an expert question setter. Return only JSON.";
    const user = `Create a question bank for Subject: ${data.subject}, Topic: ${data.topic}.
JSON schema:
{
  "mcqs": [{"question":string,"options":string[],"answer":string,"explanation":string,"difficulty":string}],
  "short": [{"question":string,"answer":string}],
  "long":  [{"question":string,"answer":string}],
  "programming": [{"question":string,"sample_code":string,"explanation":string}],
  "interview": [{"question":string,"answer":string}]
}
Provide 20 MCQs, 10 short, 8 long, 5 programming (if applicable else []), 8 interview.`;
    const raw = await callAI(system, user, { json: true });
    const content = parseJson<Record<string, unknown>>(raw);
    const { data: row, error } = await context.supabase
      .from("question_bank")
      .insert({
        user_id: context.userId,
        subject: data.subject, topic: data.topic,
        content: content as never,
      })
      .select("id")
      .single();
    if (error) { console.error("[db] insert failed", error); throw new Error("Could not save your work. Please try again."); }
    return { id: row!.id as string };
  });
