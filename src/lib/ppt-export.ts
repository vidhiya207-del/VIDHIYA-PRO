import type { Slide } from "@/lib/ppt-types";
import type { Template } from "@/lib/ppt-themes";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function safeName(s: string) {
  return (s || "presentation").replace(/[^\w\u0B80-\u0BFF\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 70) || "presentation";
}

/** Render every slide node in the hidden export stage to a data URL. */
export async function captureSlides(stage: HTMLElement, format: "png" | "jpeg" = "png"): Promise<string[]> {
  const { toPng, toJpeg } = await import("html-to-image");
  const nodes = Array.from(stage.querySelectorAll<HTMLElement>("[data-export-slide]"));
  const out: string[] = [];
  for (const node of nodes) {
    const fn = format === "png" ? toPng : toJpeg;
    out.push(await fn(node, { width: 1280, height: 720, pixelRatio: 1.5, cacheBust: true, quality: 0.95 }));
  }
  return out;
}

export async function exportImages(title: string, stage: HTMLElement, format: "png" | "jpeg") {
  const urls = await captureSlides(stage, format);
  if (urls.length === 1) {
    const blob = await (await fetch(urls[0]!)).blob();
    return download(blob, `${safeName(title)}.${format}`);
  }
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (let i = 0; i < urls.length; i++) {
    const blob = await (await fetch(urls[i]!)).blob();
    zip.file(`slide-${String(i + 1).padStart(2, "0")}.${format}`, blob);
  }
  download(await zip.generateAsync({ type: "blob" }), `${safeName(title)}-${format}.zip`);
}

export async function exportPdf(title: string, stage: HTMLElement) {
  const urls = await captureSlides(stage, "png");
  const w = window.open("", "_blank");
  if (!w) throw new Error("Pop-up blocked — allow pop-ups to export PDF.");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>@page{size:1280px 720px;margin:0}body{margin:0;background:#fff}
  img{display:block;width:1280px;height:720px;page-break-after:always}</style></head>
  <body>${urls.map((u) => `<img src="${u}">`).join("")}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 900);
}

/* ---------------- PPTX ---------------- */

const hex = (c: string, fallback: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c?.trim() ?? "");
  return m ? m[1]!.toUpperCase() : fallback;
};

export async function exportPptx(title: string, slides: Slide[], t: Template, opts?: { animations?: boolean }) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = title;

  const dark = t.dark;
  const bg = dark ? "0C1024" : "FFFFFF";
  const fg = dark ? "F5F7FF" : "121735";
  const muted = dark ? "AEB6DA" : "56607F";
  const accent = hex(t.accent, dark ? "7C8CFF" : "2F4BD8");
  const accent2 = hex(t.accent2, dark ? "34D399" : "7F5BFF");
  const heading = t.heading.includes("Georgia") || t.heading.includes("Merriweather") ? "Georgia" : "Segoe UI";

  const transition = opts?.animations ? { type: "fade" as const } : undefined;

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i]!;
    const slide = pptx.addSlide();
    slide.background = { color: bg };
    if (transition) (slide as unknown as { transition?: unknown }).transition = transition;
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: accent } });

    if (s.layout === "title") {
      slide.addText(s.title ?? title, { x: 0.7, y: 2.0, w: 8.6, h: 1.6, fontSize: 40, bold: true, color: fg, fontFace: heading });
      if (s.subtitle) slide.addText(s.subtitle, { x: 0.7, y: 3.6, w: 8.6, h: 0.9, fontSize: 18, color: muted });
      slide.addShape(pptx.ShapeType.rect, { x: 0.7, y: 4.6, w: 1.8, h: 0.06, fill: { color: accent2 } });
    } else {
      slide.addText(s.title ?? "", { x: 0.6, y: 0.45, w: 9, h: 0.9, fontSize: 26, bold: true, color: fg, fontFace: heading });
      let y = 1.5;
      if (s.body) { slide.addText(s.body, { x: 0.6, y, w: 9, h: 0.9, fontSize: 14, color: muted }); y += 0.95; }

      if (s.layout === "table" && s.table?.headers?.length) {
        const rows = [
          s.table.headers.map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: accent } } })),
          ...(s.table.rows ?? []).map((r) => r.map((c) => ({ text: String(c), options: { color: fg } }))),
        ];
        slide.addTable(rows as never, { x: 0.6, y, w: 9, fontSize: 12, border: { type: "solid", color: dark ? "334155" : "D8DDF0", pt: 1 } });
      } else if (s.layout === "chart" && s.chart?.values?.length) {
        const type = s.chart.type === "pie" ? pptx.ChartType.pie : s.chart.type === "line" ? pptx.ChartType.line : pptx.ChartType.bar;
        slide.addChart(type, [{ name: s.title ?? "Data", labels: s.chart.labels ?? [], values: s.chart.values }],
          { x: 0.8, y, w: 8.4, h: 3.4, showLegend: true, chartColors: [accent, accent2, "F59E0B", "EF4444", "10B981"] });
      } else if (s.layout === "code" && s.code) {
        slide.addShape(pptx.ShapeType.roundRect, { x: 0.6, y, w: 9, h: 3.4, fill: { color: dark ? "05070F" : "0F1530" }, line: { color: accent, width: 1 } });
        slide.addText(s.code, { x: 0.8, y: y + 0.15, w: 8.6, h: 3.1, fontSize: 11, color: "E6ECFF", fontFace: "Consolas" });
      } else if (s.layout === "two-column") {
        [s.left, s.right].forEach((col, k) => {
          slide.addText(col?.heading ?? "", { x: 0.6 + k * 4.6, y, w: 4.3, h: 0.5, fontSize: 16, bold: true, color: k ? accent2 : accent });
          slide.addText((col?.bullets ?? []).map((b) => ({ text: b, options: { bullet: true } })),
            { x: 0.6 + k * 4.6, y: y + 0.55, w: 4.3, h: 3, fontSize: 13, color: fg });
        });
      } else if (s.layout === "stats" && s.stats?.length) {
        s.stats.forEach((st, k) => {
          slide.addText(st.value, { x: 0.6 + k * 3, w: 2.8, y, h: 1, fontSize: 34, bold: true, color: k % 2 ? accent2 : accent, align: "center" });
          slide.addText(st.label, { x: 0.6 + k * 3, w: 2.8, y: y + 1, h: 0.7, fontSize: 13, color: muted, align: "center" });
        });
      } else if (s.layout === "process" && s.steps?.length) {
        s.steps.forEach((st, k) => {
          slide.addShape(pptx.ShapeType.roundRect, { x: 0.6 + k * (8.8 / s.steps!.length), y, w: 8.8 / s.steps!.length - 0.2, h: 1.6, fill: { color: dark ? "16203F" : "EEF2FB" }, line: { color: accent, width: 1 } });
          slide.addText(`${k + 1}. ${st}`, { x: 0.7 + k * (8.8 / s.steps!.length), y: y + 0.15, w: 8.8 / s.steps!.length - 0.4, h: 1.3, fontSize: 12, color: fg });
        });
      } else if (s.layout === "qa" && s.qa?.length) {
        slide.addText(s.qa.flatMap((x, k) => ([
          { text: `Q${k + 1}. ${x.q}\n`, options: { bold: true, color: accent, fontSize: 13 } },
          { text: `${x.a}\n`, options: { color: muted, fontSize: 12 } },
        ])) as never, { x: 0.6, y, w: 9, h: 3.6 });
      } else if (s.layout === "quote") {
        slide.addText(`“${s.quote ?? s.body ?? ""}”`, { x: 0.8, y: 1.8, w: 8.4, h: 2, fontSize: 24, italic: true, color: fg });
        if (s.author) slide.addText(`— ${s.author}`, { x: 0.8, y: 3.8, w: 8.4, h: 0.5, fontSize: 14, color: muted });
      } else if (s.bullets?.length) {
        slide.addText(s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
          { x: 0.6, y, w: 9, h: 3.6, fontSize: 15, color: fg, lineSpacingMultiple: 1.3 });
      }
    }

    slide.addText(`${i + 1} / ${slides.length}`, { x: 8.4, y: 5.05, w: 1.2, h: 0.35, fontSize: 10, color: muted, align: "right" });
    if (s.notes) slide.addNotes(s.notes);
  }

  await pptx.writeFile({ fileName: `${safeName(title)}.pptx` });
}
