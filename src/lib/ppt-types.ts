export type SlideLayout =
  | "title" | "section" | "bullets" | "two-column" | "table" | "chart"
  | "code" | "quote" | "process" | "stats" | "qa" | "summary";

export type Slide = {
  id: string;
  layout: SlideLayout;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  body?: string;
  left?: { heading?: string; bullets?: string[] };
  right?: { heading?: string; bullets?: string[] };
  table?: { headers: string[]; rows: string[][] };
  chart?: { type: "bar" | "line" | "pie"; labels: string[]; values: number[]; caption?: string };
  steps?: string[];
  stats?: { value: string; label: string }[];
  qa?: { q: string; a: string }[];
  code?: string;
  language?: string;
  quote?: string;
  author?: string;
  icon?: string;
  notes?: string;
};

export type DeckSettings = {
  animations: boolean;
  animation: "fade" | "zoom" | "slide" | "morph" | "appear";
  accent?: string;
  accent2?: string;
  headingFont?: string;
  bodyFont?: string;
  motif?: string;
};

export const DEFAULT_SETTINGS: DeckSettings = { animations: true, animation: "fade" };

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function normalizeSlides(raw: unknown): Slide[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    const legacyType = String(o.type ?? "");
    const layout = (o.layout as SlideLayout) ?? (["title", "content", "bullets", "code", "summary"].includes(legacyType)
      ? (legacyType === "content" ? "bullets" : (legacyType as SlideLayout))
      : "bullets");
    return { ...(o as object), id: (o.id as string) ?? newId(), layout } as Slide;
  });
}
