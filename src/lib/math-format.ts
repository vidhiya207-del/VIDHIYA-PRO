/**
 * Converts LaTeX / TeX-ish math into clean, readable Unicode notation.
 * Users must never see raw `$`, `\sqrt`, `\times`, `\frac`, `^2`, etc.
 */

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷",
  "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ",
  i: "ⁱ", x: "ˣ", a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", k: "ᵏ", m: "ᵐ", t: "ᵗ", ".": "·",
};

const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇",
  "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", i: "ᵢ", j: "ⱼ", k: "ₖ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ",
  r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

const SYMBOLS: [RegExp, string][] = [
  [/\\times/g, "×"], [/\\cdot/g, "·"], [/\\div/g, "÷"], [/\\pm/g, "±"], [/\\mp/g, "∓"],
  [/\\leq?\b/g, "≤"], [/\\geq?\b/g, "≥"], [/\\neq\b/g, "≠"], [/\\approx/g, "≈"],
  [/\\equiv/g, "≡"], [/\\propto/g, "∝"], [/\\infty/g, "∞"], [/\\partial/g, "∂"],
  [/\\sum/g, "∑"], [/\\prod/g, "∏"], [/\\int/g, "∫"], [/\\nabla/g, "∇"],
  [/\\Rightarrow/g, "⇒"], [/\\Leftarrow/g, "⇐"], [/\\Leftrightarrow/g, "⇔"],
  [/\\rightarrow|\\to\b/g, "→"], [/\\leftarrow/g, "←"], [/\\leftrightarrow/g, "↔"],
  [/\\therefore/g, "∴"], [/\\because/g, "∵"], [/\\angle/g, "∠"], [/\\degree|\^\\circ|\\circ/g, "°"],
  [/\\in\b/g, "∈"], [/\\notin\b/g, "∉"], [/\\subset/g, "⊂"], [/\\subseteq/g, "⊆"],
  [/\\cup/g, "∪"], [/\\cap/g, "∩"], [/\\emptyset|\\varnothing/g, "∅"],
  [/\\forall/g, "∀"], [/\\exists/g, "∃"], [/\\ldots|\\dots|\\cdots/g, "…"],
  [/\\alpha/g, "α"], [/\\beta/g, "β"], [/\\gamma/g, "γ"], [/\\delta/g, "δ"],
  [/\\Delta/g, "Δ"], [/\\epsilon|\\varepsilon/g, "ε"], [/\\zeta/g, "ζ"], [/\\eta/g, "η"],
  [/\\theta/g, "θ"], [/\\Theta/g, "Θ"], [/\\lambda/g, "λ"], [/\\Lambda/g, "Λ"],
  [/\\mu/g, "μ"], [/\\nu/g, "ν"], [/\\xi/g, "ξ"], [/\\pi/g, "π"], [/\\Pi/g, "Π"],
  [/\\rho/g, "ρ"], [/\\sigma/g, "σ"], [/\\Sigma/g, "Σ"], [/\\tau/g, "τ"],
  [/\\phi|\\varphi/g, "φ"], [/\\Phi/g, "Φ"], [/\\chi/g, "χ"], [/\\psi/g, "ψ"],
  [/\\omega/g, "ω"], [/\\Omega/g, "Ω"],
  [/\\%/g, "%"], [/\\\$/g, "$"], [/\\&/g, "&"], [/\\#/g, "#"], [/\\_/g, "_"],
  [/\\,|\\;|\\:|\\!|\\quad|\\qquad/g, " "],
];

function toScript(body: string, map: Record<string, string>): string | null {
  const out = [...body].map((ch) => (ch === " " ? "" : map[ch] ?? map[ch.toLowerCase()] ?? null));
  return out.every((c) => c !== null) ? out.join("") : null;
}

/** Turn a LaTeX math body into readable Unicode. */
function latexToUnicode(input: string): string {
  let s = input;

  // Environments / alignment -> plain lines
  s = s.replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}/g, "");
  s = s.replace(/\\\\/g, "\n").replace(/(?<!\\)&/g, " ");

  // Wrappers that carry no visual meaning
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\(?:text|mathrm|mathbf|textbf|mathit|textit|operatorname|mbox)\s*\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\(?:displaystyle|limits|nolimits|boldsymbol|rm|bf|it)\b/g, "");

  // Roots
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\\sqrt\s*\[\s*3\s*\]\s*\{([^{}]*)\}/g, (_, a: string) => `∛(${a})`);
    s = s.replace(/\\sqrt\s*\[\s*([^\]]*)\]\s*\{([^{}]*)\}/g, (_, n: string, a: string) => `(${a})^(1/${n})`);
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, a: string) =>
      /^[\w.]+$/.test(a.trim()) ? `√${a.trim()}` : `√(${a.trim()})`);
    s = s.replace(/\\sqrt\s*([A-Za-z0-9.]+)/g, (_, a: string) => `√${a}`);
    // Fractions
    s = s.replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a: string, b: string) => {
      const wrap = (v: string) => (/^[\w.]+$/.test(v.trim()) ? v.trim() : `(${v.trim()})`);
      return `${wrap(a)}/${wrap(b)}`;
    });
  }

  // Symbols
  for (const [re, rep] of SYMBOLS) s = s.replace(re, rep);

  // Super / subscripts
  s = s.replace(/\^\s*\{([^{}]+)\}/g, (m, b: string) => toScript(b, SUP) ?? `^(${b})`);
  s = s.replace(/\^\s*([A-Za-z0-9])/g, (m, b: string) => toScript(b, SUP) ?? m);
  s = s.replace(/_\s*\{([^{}]+)\}/g, (m, b: string) => toScript(b, SUB) ?? `_(${b})`);
  s = s.replace(/_\s*([A-Za-z0-9])/g, (m, b: string) => toScript(b, SUB) ?? m);

  // Remaining commands: keep the readable word (\sin -> sin), drop the backslash
  s = s.replace(/\\([A-Za-z]+)/g, "$1");
  s = s.replace(/[{}]/g, "");
  return s.replace(/[ \t]{2,}/g, " ").trim();
}

/** A `$...$` span only counts as math when it actually contains math syntax. */
const LOOKS_LIKE_MATH = /[\\^_]|[+\-×÷=<>]\s*\d|\d\s*[+\-*/=]/;

/** Convert every math span in a plain-text string into readable notation. */
export function formatMathText(text: string): string {
  if (!text || (!text.includes("$") && !text.includes("\\"))) return text;
  let s = text;
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, b: string) => latexToUnicode(b));
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, b: string) => latexToUnicode(b));
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, b: string) => latexToUnicode(b));
  s = s.replace(/\$([^$\n]+?)\$/g, (m, b: string) => (LOOKS_LIKE_MATH.test(b) ? latexToUnicode(b) : m));
  // Stray LaTeX left outside any delimiter
  if (/\\[A-Za-z]+|\^\{|_\{/.test(s)) s = latexToUnicode(s);
  // Leftover unmatched dollar signs (never touch real currency like $25)
  s = s.replace(/\$(?![\d.])/g, "");
  return s;
}


const SKIP_BLOCK = /<(pre|code|svg|script|style)\b[\s\S]*?<\/\1>/gi;

/** Convert math inside an HTML fragment, leaving tags, code blocks and SVG untouched. */
export function formatMathHtml(html: string): string {
  if (!html) return html;
  const blocks: string[] = [];
  let work = html.replace(SKIP_BLOCK, (m) => {
    blocks.push(m);
    return `\u0000${blocks.length - 1}\u0000`;
  });

  work = work
    .split(/(<[^>]+>)/g)
    .map((chunk) => (chunk.startsWith("<") ? chunk : formatMathText(chunk)))
    .join("");

  return work.replace(/\u0000(\d+)\u0000/g, (_, i: string) => blocks[Number(i)] ?? "");
}

/** Recursively format math in every string of a JSON-ish value. */
export function formatMathDeep<T>(value: T): T {
  if (typeof value === "string") return formatMathText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => formatMathDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = formatMathDeep(v);
    return out as unknown as T;
  }
  return value;
}
