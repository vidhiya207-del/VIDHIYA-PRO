import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { formatMathHtml } from "@/lib/math-format";
import { repairTruncatedHtml } from "@/lib/html-repair";
import { callAiGateway, AiUnavailableError } from "@/lib/ai-gateway";


const STYLE_BRIEF: Record<string, string> = {
  short:
    "SHORT NOTES: crisp and compact per topic. Follow the per-topic template but keep explanations tight — essential definitions, key points, formulas and one example per topic.",
  detailed:
    "DETAILED NOTES: full teaching depth per topic. Explain every concept from first principles with analogies, worked examples, tables and diagrams.",
  exam:
    "EXAM PREPARATION NOTES: organised around what gets asked. Per topic include the definition, 2-mark points, 5-mark answer material, 10-mark structured answer material, plus likely exam questions with model answers and common mistakes.",
  revision:
    "REVISION NOTES: last-minute recap per topic. Heavy use of tables, comparison charts, bullet lists, mnemonics and formula sheets, while still covering every listed topic with its diagram and key points.",
  classroom:
    "CLASSROOM NOTES: teaching-flow oriented per topic. Learning objectives, board-work sequence, explanation script, examples to demonstrate, student activity, questions to ask the class, and a recap.",
};

const SYSTEM = `You are a senior college professor and instructional designer who writes flawless, complete, student-friendly unit notes.

COVERAGE CONTRACT (the most important rule):
- The user message lists the unit's topics and subtopics (in the "Topic / Unit" field and/or the uploaded reference material).
- You MUST produce a dedicated, complete section for EVERY single listed topic and subtopic, in the exact order given.
- NEVER skip a topic, NEVER merge two topics into one section, and NEVER reduce a topic to a one-line summary or a passing mention.
- When reference material is supplied, it is the primary source of truth: follow its terminology, topic order, concepts, formulas, examples and level of technical detail. NEVER merely summarize it — expand it into full teaching-style notes a student can learn from without a teacher, and never contradict it.

PER-TOPIC TEMPLATE — for EACH topic/subtopic output an <h2> with the topic name, then these blocks in order, each introduced by an <h3> label:
1. "Simple Definition" — a <div class="callout"> with a one- or two-sentence definition in very simple language.
2. "Concept Explanation" — explain clearly in student-friendly language: WHAT it is, WHY it is used, WHAT happens, and HOW it works. Define every important term the first time it appears. Never give only theoretical statements.
3. "How It Works / Method" — REQUIRED whenever the topic involves a process, algorithm, method, workflow, formula or procedure. NEVER describe an algorithm in one paragraph. Give numbered steps ("Step 1 – Choose K", "Step 2 – Initialize Centroids", ...) and for EACH step explain: what happens in this step, why this step is required, what input is used, what calculation/action is performed, what output is produced, and what happens next. Example depth for K-Means: Step 1 choose K (what K means, why we choose it) → Step 2 initialize centroids (what a centroid is, how initial ones are picked) → Step 3 calculate distance (show the distance formula, explain each value) → Step 4 assign points (compare distances, explain why a point joins a cluster) → Step 5 recompute centroids (show the mean calculation) → Step 6 repeat (why assignment/update repeat) → Step 7 check convergence (when it stops).
4. "Diagram" — REQUIRED for every topic where a visual helps (algorithms, processes, architectures, trees, graphs, data flow, comparisons). Draw a SEPARATE, CLEAR, LABELED inline <svg> inside a <figure> with a <figcaption>, designed specifically for THIS topic. NEVER reuse one generic diagram across topics and NEVER repeat the same layout twice in a note. The diagram must directly explain the topic: show the correct flow/steps with arrows in the right direction, give every node, box, axis and arrow a text label, and add a short diagram title. It must be readable at a glance by a first-year student. Prefer flow/chain layouts that mirror the method. Match these flows when the topic fits (invent an equally specific flow otherwise): Clustering: "Raw Data → Similarity/Distance → Clusters"; K-Means: "Data Points → Initial Centroids → Distance Calculation → Assignment → New Centroids → Repeat → Final Clusters"; K-Means Method: "Initialize → Assign → Update → Convergence Check → Repeat if necessary"; Decision Tree: "Root Node → Decision → Branches → Leaf/Class"; Decision Tree Evaluation: "Actual vs Predicted → Confusion Matrix → Accuracy / Precision / Recall / F1"; Bayes' Theorem: "Prior × Likelihood ÷ Evidence → Posterior"; Naïve Bayes: "Class → Feature 1 + Feature 2 + Feature 3 → Posterior Probability → Predicted Class"; Smoothing: "Zero Probability → Add-1 Smoothing → Non-Zero Probability".
5. "Example" — at least one simple example that DIRECTLY demonstrates this exact concept (no unrelated examples), explained step by step with easy numbers/data.
6. "Worked Example / Calculation" — REQUIRED whenever the topic involves any calculation, formula or numerical method. Follow this exact pattern: Given Data → Formula → Substitute Values → Calculate (every intermediate step, one per line) → Result → Interpretation of the result. Never skip intermediate steps. Omit this block only when the topic genuinely has no calculation. Cover these calculations when the topic matches: K-Means → distance calculation, cluster assignment, centroid recalculation, WCSS; Decision Trees → entropy, information gain, Gini impurity; Bayes' Theorem → prior, likelihood, evidence, posterior with the complete calculation; Naïve Bayes → prior probability, conditional probabilities, multiplication, comparison of class scores, final classification; Smoothing → probability without smoothing, the zero-frequency problem, the Laplace (add-1) smoothing formula, probability after smoothing.
7. "Advantages" — a short bullet list of meaningful, topic-relevant advantages (omit only when truly not applicable).
8. "Limitations" — a short bullet list of meaningful, topic-relevant limitations (omit only when truly not applicable).
9. "Key Points" — a <div class="callout"> with the most important concepts, formulas, steps and terms of the topic for quick revision.

GOLDEN SEQUENCE (most important rule after coverage): never explain only WHAT a concept is — always explain HOW it works. For every method, algorithm, formula or procedure, the blocks must combine into this exact teaching flow: Concept → Purpose → Steps → Explanation of Each Step → Diagram → Example → Calculation → Result → Interpretation. After finishing a topic, a student must be able to perform the method by hand on new data.

R / PROGRAMMING TOPICS — whenever a topic involves a programming language or tool (e.g. "K-Means Analysis using R", "Decision Tree in R", "Naïve Bayes in R", "... using Python"):
- State the purpose of the implementation, the required packages/functions, the dataset used, and how the data is prepared.
- Give COMPLETE runnable code in <pre><code>, then explain the important lines one by one.
- Explain every important function parameter, e.g. for kmeans(data, centers = 3, nstart = 25): what kmeans() does, what data is, what centers = 3 means, what nstart = 25 means and why it is used. Apply the same depth to rpart(), predict(), naiveBayes() and similar functions.
- Show a realistic sample output inside a separate <pre> block, then explain how to read that output and give the final interpretation.
- Never provide code without explanation.

OUTPUT RULES (critical):
- Return ONLY an HTML fragment. No markdown, no code fences, no <html>/<head>/<body> wrapper, no commentary.
- Allowed tags: h1 h2 h3 h4 p ul ol li table thead tbody tr th td pre code blockquote strong em mark hr br div figure figcaption svg (with its child elements).
- Use <h1> once for the note title, <h2> for each topic, <h3> for the template blocks and sub-sections.
- Use <table> for comparisons, classifications, before-vs-after demonstrations and any structured data.
- Use <mark> to highlight critical keywords, and <strong> for definitions and formulas.
- Use <div class="callout"> for definitions, key formulas, exam tips and "remember this" boxes.
- Use <pre><code> for programs/syntax, followed by a line-by-line explanation.
- All diagrams are clean inline <svg> (viewBox set, no external refs, use currentColor for strokes/text so they work in light and dark mode, font-size 13-15), each wrapped in a <figure> with a <figcaption>.
- NEVER output LaTeX or TeX. No $ ... $, no $$ ... $$, no \\( \\), no \\frac, \\sqrt, \\times, \\div, ^2, _n.
- Write all mathematics as plain readable Unicode: × ÷ √ ∛ ² ³ ⁿ ≤ ≥ ≠ ± ° π ∑ ∫ → ≈, e.g. "Distance = √(20² + 40²) = √2000 = 20√5 km".
- Show calculations step by step, one step per line (use <br> inside a <p> or a <pre> block), keeping steps aligned and easy to scan.
- Do NOT include exam questions, practice questions or quizzes in the notes body unless the note type explicitly asks for them.
- The final output must read as COMPLETE college study notes a student can learn from without a teacher — never a short summary, outline, or bullet-only cheat sheet. Depth is mandatory: full sentences, full explanations, full calculations.
- When reference material is uploaded, preserve its topic order, terminology, notation, formulas and every important concept exactly — expand them, never compress them.
- Write clear, simple language a first-year college student can follow.`;

type Part =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function callAI(parts: Part[]) {
  return callAiGateway(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: parts },
    ],
    // Keep a useful response size while avoiding unnecessarily long free-tier
    // generations for a single request.
    { maxTokens: 12000, attempts: 2 },
  );
}


function cleanHtml(raw: string) {
  let html = raw.trim();
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "");
  html = html.replace(/<\/?(?:html|head|body|script|style|iframe)[^>]*>/gi, "");
  html = html.replace(/\son\w+="[^"]*"/gi, "");
  return formatMathHtml(repairTruncatedHtml(html.trim()));
}

const SourceSchema = z.object({
  name: z.string().max(300),
  kind: z.string().max(20),
  text: z.string().max(45000),
  images: z.array(z.string()).max(4),
});

export const generateRichNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        subject: z.string().trim().min(1).max(120),
        topic: z.string().trim().min(1).max(2000),
        department: z.string().trim().max(80).optional(),
        style: z.enum(["short", "detailed", "exam", "revision", "classroom"]),
        language: z.enum(["en", "ta", "bi"]),
        instructions: z.string().trim().max(1500).optional(),
        sources: z.array(SourceSchema).max(8).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const languageBrief =
      data.language === "ta"
        ? "Write ALL content in Tamil (தமிழ்). Keep technical terms in English inside parentheses where helpful."
        : data.language === "bi"
          ? "Write bilingually: each section in English first, then a concise Tamil (தமிழ்) explanation below it."
          : "Write in clear English.";

    const refText = data.sources
      .filter((s) => s.text.trim().length > 0)
      .map((s, i) => `\n===== REFERENCE FILE ${i + 1}: ${s.name} (${s.kind}) =====\n${s.text}`)
      .join("\n");

    const images = data.sources.flatMap((s) => s.images).slice(0, 8);

    const prompt = `Create college teaching notes.

Subject: ${data.subject}
Topic / Unit: ${data.topic}
Department: ${data.department ?? "General"}
Note type: ${STYLE_BRIEF[data.style]}
Language: ${languageBrief}
${data.instructions ? `Extra instructions from the staff member: ${data.instructions}` : ""}

${
  refText || images.length
    ? `The staff member uploaded reference material below${images.length ? " (plus attached page images / scanned or handwritten notes — read them carefully)" : ""}. Treat it as the PRIMARY syllabus source: cover every topic it contains, in its order, expanding and explaining each one.`
    : "No reference files were uploaded — build the notes from the subject and topic using a standard university syllabus."
}
${refText}

COVERAGE REMINDER: The "Topic / Unit" field above may list several unit topics and subtopics (one per line). Generate a COMPLETE notes section for EVERY single listed topic and subtopic, in the given order, each following the full per-topic template: Simple Definition → Concept Explanation → How It Works / Method (numbered steps, each step explained) → topic-specific Diagram → Example → Worked Example / Calculation (Given Data → Formula → Substitute → Calculate → Result → Interpretation) → Advantages → Limitations → Key Points — plus complete code with line-by-line parameter explanation and sample output for any R/programming topic. The notes must read like a complete classroom explanation, not a summary. Do not skip, merge, or shorten any of them.

Now produce the complete HTML fragment.`;

    const parts: Part[] = [{ type: "text", text: prompt }];
    for (const url of images) parts.push({ type: "image_url", image_url: { url } });

    const html = cleanHtml(await callAI(parts));
    if (!html) throw new AiUnavailableError();

    const { data: row, error } = await context.supabase
      .from("notes")
      .insert({
        user_id: context.userId,
        subject: data.subject,
        topic: data.topic,
        department: data.department ?? null,
        title: `${data.topic}`,
        body_html: html,
        style: data.style,
        language: data.language,
        sources: data.sources.map((s) => ({ name: s.name, kind: s.kind })) as never,
        content: {} as never,
      })
      .select("id")
      .single();
    if (error) { console.error("[db] insert failed", error); throw new Error("Could not save your work. Please try again."); }
    return { id: row!.id as string };
  });
