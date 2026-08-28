/* Template + background design system for the AI Presentation Generator. */

export type TemplateId =
  | "professional" | "modern" | "minimal" | "glass" | "dark" | "corporate"
  | "academic" | "technology" | "medical" | "business" | "startup" | "education"
  | "research" | "creative" | "gradient" | "threed" | "animated";

export type Template = {
  id: TemplateId;
  name: string;
  dark: boolean;
  /** page background (css) */
  bg: string;
  /** panel/surface behind content */
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  heading: string;
  body: string;
  /** shadow/extra styling for content panel */
  panel?: string;
};

export const FONT_STACKS: Record<string, string> = {
  Inter: "'Inter', system-ui, -apple-system, sans-serif",
  Poppins: "'Poppins', 'Inter', system-ui, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Merriweather: "'Merriweather', Georgia, serif",
  Manrope: "'Manrope', 'Inter', sans-serif",
  Mono: "'JetBrains Mono', Consolas, monospace",
};

export const TEMPLATES: Template[] = [
  { id: "professional", name: "Professional", dark: false, bg: "linear-gradient(135deg,#f7f9ff 0%,#eef2fb 100%)", surface: "rgba(255,255,255,.86)", border: "rgba(35,48,110,.14)", text: "#101735", muted: "#4b5578", accent: "#2f4bd8", accent2: "#7f5bff", heading: FONT_STACKS.Inter, body: FONT_STACKS.Inter },
  { id: "modern", name: "Modern", dark: true, bg: "linear-gradient(135deg,#0d1230 0%,#1c1f4d 55%,#341a5c 100%)", surface: "rgba(255,255,255,.06)", border: "rgba(255,255,255,.16)", text: "#f6f7ff", muted: "#b9bfe6", accent: "#7c8cff", accent2: "#ff7ac3", heading: FONT_STACKS.Poppins, body: FONT_STACKS.Inter },
  { id: "minimal", name: "Minimal", dark: false, bg: "#ffffff", surface: "rgba(0,0,0,.02)", border: "rgba(0,0,0,.10)", text: "#0c0c0c", muted: "#5c5c5c", accent: "#111111", accent2: "#8a8a8a", heading: FONT_STACKS.Inter, body: FONT_STACKS.Inter },
  { id: "glass", name: "Glassmorphism", dark: true, bg: "radial-gradient(1200px 600px at 15% 10%,#3b2c8f 0%,transparent 60%),radial-gradient(900px 600px at 85% 85%,#0e7490 0%,transparent 60%),#0a0d20", surface: "rgba(255,255,255,.10)", border: "rgba(255,255,255,.28)", text: "#ffffff", muted: "#d7dcff", accent: "#8ab6ff", accent2: "#61f5d4", heading: FONT_STACKS.Poppins, body: FONT_STACKS.Inter, panel: "backdrop-filter:blur(18px);box-shadow:0 24px 60px rgba(0,0,0,.35)" },
  { id: "dark", name: "Dark Theme", dark: true, bg: "#07080d", surface: "rgba(255,255,255,.05)", border: "rgba(255,255,255,.12)", text: "#f2f4f8", muted: "#9aa2b5", accent: "#4ade80", accent2: "#38bdf8", heading: FONT_STACKS.Inter, body: FONT_STACKS.Inter },
  { id: "corporate", name: "Corporate", dark: false, bg: "linear-gradient(120deg,#ffffff 0%,#f1f5f9 100%)", surface: "rgba(255,255,255,.95)", border: "rgba(15,42,80,.16)", text: "#0f2a50", muted: "#4a5b76", accent: "#0f5ea8", accent2: "#0aa5a0", heading: FONT_STACKS.Inter, body: FONT_STACKS.Inter },
  { id: "academic", name: "Academic", dark: false, bg: "linear-gradient(135deg,#fdfbf6 0%,#f3eee3 100%)", surface: "rgba(255,255,255,.9)", border: "rgba(90,70,40,.20)", text: "#241d10", muted: "#5f5442", accent: "#8a5a1b", accent2: "#2f5d50", heading: FONT_STACKS.Merriweather, body: FONT_STACKS.Georgia },
  { id: "technology", name: "Technology", dark: true, bg: "linear-gradient(140deg,#03121f 0%,#062b3d 60%,#01121a 100%)", surface: "rgba(6,182,212,.08)", border: "rgba(34,211,238,.30)", text: "#e6fbff", muted: "#93c9d8", accent: "#22d3ee", accent2: "#a3e635", heading: FONT_STACKS.Manrope, body: FONT_STACKS.Inter },
  { id: "medical", name: "Medical", dark: false, bg: "linear-gradient(135deg,#f4fbff 0%,#e8f7f3 100%)", surface: "rgba(255,255,255,.92)", border: "rgba(10,110,120,.18)", text: "#06303a", muted: "#3f6570", accent: "#0891b2", accent2: "#16a34a", heading: FONT_STACKS.Inter, body: FONT_STACKS.Inter },
  { id: "business", name: "Business", dark: false, bg: "linear-gradient(135deg,#fffaf3 0%,#f6efe6 100%)", surface: "rgba(255,255,255,.94)", border: "rgba(90,60,20,.16)", text: "#221708", muted: "#5c4a34", accent: "#b45309", accent2: "#1f6f5c", heading: FONT_STACKS.Poppins, body: FONT_STACKS.Inter },
  { id: "startup", name: "Startup", dark: true, bg: "linear-gradient(135deg,#180b2e 0%,#3b0f4d 45%,#0f1240 100%)", surface: "rgba(255,255,255,.08)", border: "rgba(255,255,255,.18)", text: "#fdf4ff", muted: "#d6bdf0", accent: "#f472b6", accent2: "#facc15", heading: FONT_STACKS.Poppins, body: FONT_STACKS.Inter },
  { id: "education", name: "Education", dark: false, bg: "linear-gradient(135deg,#f5fbff 0%,#eef6ff 100%)", surface: "rgba(255,255,255,.92)", border: "rgba(20,70,140,.16)", text: "#0d2540", muted: "#456287", accent: "#2563eb", accent2: "#f59e0b", heading: FONT_STACKS.Inter, body: FONT_STACKS.Inter },
  { id: "research", name: "Research", dark: false, bg: "linear-gradient(135deg,#fbfbfd 0%,#eff1f6 100%)", surface: "rgba(255,255,255,.95)", border: "rgba(40,50,70,.18)", text: "#141a26", muted: "#4d566b", accent: "#334e9c", accent2: "#8a2c5e", heading: FONT_STACKS.Merriweather, body: FONT_STACKS.Inter },
  { id: "creative", name: "Creative", dark: true, bg: "linear-gradient(120deg,#ff5f6d 0%,#8b5cf6 50%,#0ea5e9 100%)", surface: "rgba(0,0,0,.24)", border: "rgba(255,255,255,.30)", text: "#ffffff", muted: "#f2e9ff", accent: "#ffe066", accent2: "#5eead4", heading: FONT_STACKS.Poppins, body: FONT_STACKS.Inter },
  { id: "gradient", name: "Gradient", dark: true, bg: "linear-gradient(135deg,#2b1055 0%,#7597de 100%)", surface: "rgba(255,255,255,.10)", border: "rgba(255,255,255,.22)", text: "#ffffff", muted: "#e2e8ff", accent: "#ffd166", accent2: "#06d6a0", heading: FONT_STACKS.Manrope, body: FONT_STACKS.Inter },
  { id: "threed", name: "3D Style", dark: true, bg: "radial-gradient(900px 500px at 20% 0%,#4338ca 0%,transparent 55%),radial-gradient(900px 500px at 100% 100%,#0891b2 0%,transparent 55%),#0b1020", surface: "rgba(255,255,255,.09)", border: "rgba(255,255,255,.22)", text: "#f8fbff", muted: "#c2cdf5", accent: "#60a5fa", accent2: "#f472b6", heading: FONT_STACKS.Poppins, body: FONT_STACKS.Inter, panel: "box-shadow:0 30px 70px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.25)" },
  { id: "animated", name: "Animated Theme", dark: true, bg: "linear-gradient(135deg,#101a3d,#2d1b58,#0f3f52,#101a3d)", surface: "rgba(255,255,255,.08)", border: "rgba(255,255,255,.20)", text: "#f7f9ff", muted: "#c3cbf0", accent: "#a78bfa", accent2: "#34d399", heading: FONT_STACKS.Poppins, body: FONT_STACKS.Inter },
];

export function getTemplate(id?: string | null): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]!;
}

/* ---------------- Topic-aware background motifs ---------------- */

export type Motif =
  | "circuit" | "network" | "database" | "security" | "ai" | "medical"
  | "business" | "science" | "education" | "code" | "generic";

const MOTIF_RULES: { motif: Motif; words: string[] }[] = [
  { motif: "security", words: ["security", "cyber", "hacking", "encryption", "cryptograph", "firewall", "malware", "forensic"] },
  { motif: "database", words: ["database", "dbms", "sql", "rdbms", "data warehouse", "normalization", "transaction", "nosql"] },
  { motif: "network", words: ["network", "tcp", "ip", "routing", "osi", "cloud", "internet", "protocol", "distributed", "wireless"] },
  { motif: "ai", words: ["artificial intelligence", " ai", "machine learning", "deep learning", "neural", "nlp", "data science", "robot"] },
  { motif: "circuit", words: ["operating system", "computer architecture", "microprocessor", "embedded", "hardware", "vlsi", "digital electronics", "cpu", "memory management"] },
  { motif: "code", words: ["programming", "java", "python", "c++", "oops", "object oriented", "data structure", "algorithm", "compiler", "software"] },
  { motif: "medical", words: ["medical", "anatomy", "nursing", "biology", "pharma", "health", "clinical", "genetic"] },
  { motif: "business", words: ["business", "marketing", "management", "finance", "startup", "economics", "entrepreneur", "hr"] },
  { motif: "science", words: ["physics", "chemistry", "mathematics", "research", "thermodynamics", "mechanic", "quantum", "statistic"] },
  { motif: "education", words: ["education", "pedagog", "school", "teaching", "curriculum", "ugc net", "exam"] },
];

export function detectMotif(...parts: (string | undefined | null)[]): Motif {
  const t = parts.filter(Boolean).join(" ").toLowerCase();
  for (const rule of MOTIF_RULES) if (rule.words.some((w) => t.includes(w))) return rule.motif;
  return "generic";
}

export const MOTIF_LABEL: Record<Motif, string> = {
  circuit: "Circuits & CPU", network: "Network & cloud", database: "Database & SQL",
  security: "Security & shields", ai: "Neural network", medical: "Medical",
  business: "Business growth", science: "Science", education: "Education",
  code: "Code & logic", generic: "Abstract",
};
