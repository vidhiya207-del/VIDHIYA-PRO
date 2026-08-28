/* Browser-side extraction of text/images from uploaded reference files. */

export type ExtractedSource = {
  name: string;
  kind: "pdf" | "docx" | "pptx" | "txt" | "image" | "other";
  text: string;
  /** data URLs for pages/images that need visual (OCR-style) understanding */
  images: string[];
  chars: number;
};

const MAX_CHARS_PER_FILE = 40000;
const MAX_IMAGES_PER_FILE = 4;

function clamp(text: string) {
  const t = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  return t.length > MAX_CHARS_PER_FILE ? t.slice(0, MAX_CHARS_PER_FILE) + "\n…[truncated]" : t;
}

async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Could not read file"));
    fr.readAsDataURL(file);
  });
}

async function extractPdf(file: File): Promise<{ text: string; images: string[] }> {
  const pdfjs = await import("pdfjs-dist");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjs as any).GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    text += `\n\n--- Page ${i} ---\n${pageText}`;
    if (text.length > MAX_CHARS_PER_FILE) break;
  }

  const images: string[] = [];
  // Scanned / handwritten PDFs yield almost no text → rasterize pages for vision.
  if (text.replace(/---\s*Page\s*\d+\s*---/g, "").trim().length < 200) {
    const pages = Math.min(doc.numPages, MAX_IMAGES_PER_FILE);
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(viewport.width, 1400);
      canvas.height = Math.round((canvas.width / viewport.width) * viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      const scaled = page.getViewport({ scale: canvas.width / page.getViewport({ scale: 1 }).width });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page as any).render({ canvas, canvasContext: ctx, viewport: scaled }).promise;
      images.push(canvas.toDataURL("image/jpeg", 0.75));
    }
  }
  return { text, images };
}

async function extractDocx(file: File): Promise<string> {
  // Browser build keeps us clear of Node-only deps.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mammoth: any = await import("mammoth/mammoth.browser.js");
  const arrayBuffer = await file.arrayBuffer();
  const api = mammoth.default ?? mammoth;
  const res = await api.convertToHtml({ arrayBuffer });
  return String(res.value ?? "");
}

async function extractPptx(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  let out = "";
  for (const name of slideNames) {
    const xml = await zip.files[name]!.async("string");
    const texts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]);
    out += `\n\n--- Slide ${name.match(/\d+/)![0]} ---\n${texts.join("\n")}`;
  }
  return out;
}

export async function extractFromFile(file: File): Promise<ExtractedSource> {
  const name = file.name;
  const lower = name.toLowerCase();
  const base: ExtractedSource = { name, kind: "other", text: "", images: [], chars: 0 };

  try {
    if (file.type.startsWith("image/")) {
      const url = await fileToDataUrl(file);
      return { ...base, kind: "image", images: [url], text: "", chars: 0 };
    }
    if (lower.endsWith(".pdf") || file.type === "application/pdf") {
      const { text, images } = await extractPdf(file);
      return { ...base, kind: "pdf", text: clamp(text), images, chars: text.length };
    }
    if (lower.endsWith(".docx")) {
      const html = await extractDocx(file);
      return { ...base, kind: "docx", text: clamp(html), chars: html.length };
    }
    if (lower.endsWith(".pptx")) {
      const text = await extractPptx(file);
      return { ...base, kind: "pptx", text: clamp(text), chars: text.length };
    }
    if (lower.endsWith(".txt") || lower.endsWith(".md") || file.type.startsWith("text/")) {
      const text = await file.text();
      return { ...base, kind: "txt", text: clamp(text), chars: text.length };
    }
    if (lower.endsWith(".doc")) {
      throw new Error("Legacy .doc is not supported — please save as .docx or PDF.");
    }
    throw new Error("Unsupported file type.");
  } catch (err) {
    throw new Error(`${name}: ${(err as Error).message}`);
  }
}
