/* Export a note document to PDF (print), DOCX, TXT and HTML with formatting preserved. */

const PRINT_CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111; line-height: 1.65; font-size: 12pt; }
  h1 { font-size: 22pt; margin: 0 0 10pt; }
  h2 { font-size: 16pt; color: #23306e; margin: 18pt 0 6pt; border-bottom: 1px solid #d9dced; padding-bottom: 3pt; }
  h3 { font-size: 13pt; margin: 12pt 0 4pt; }
  p, li { font-size: 12pt; }
  ul { padding-left: 18pt; } ol { padding-left: 20pt; }
  table { width: 100%; border-collapse: collapse; margin: 10pt 0; }
  th, td { border: 1px solid #9aa1c4; padding: 6pt 8pt; text-align: left; vertical-align: top; font-size: 11pt; }
  th { background: #eceffa; }
  pre { background: #f4f5fa; border: 1px solid #d9dced; padding: 8pt; border-radius: 4pt; font-family: Consolas, monospace; font-size: 10pt; white-space: pre-wrap; }
  code { font-family: Consolas, monospace; }
  blockquote { border-left: 3pt solid #3b4cae; margin: 8pt 0; padding: 4pt 10pt; background: #f4f5fa; }
  .callout { border: 1px solid #c9cee8; border-left: 3pt solid #3b4cae; background: #f6f7fc; padding: 8pt 10pt; margin: 8pt 0; border-radius: 4pt; }
  mark { background: #fff3a3; }
  img, svg { max-width: 100%; height: auto; }
  figure { margin: 10pt 0; text-align: center; page-break-inside: avoid; }
  figcaption { font-size: 10pt; color: #555; margin-top: 3pt; }
  h1, h2, h3 { page-break-after: avoid; }
  table, pre, blockquote, .callout { page-break-inside: avoid; }
`;

function wrapDocument(title: string, html: string, extraHead = "") {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${PRINT_CSS}</style>${extraHead}</head>
<body>${html}</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileName(name: string) {
  return (name || "notes").replace(/[^\w\u0B80-\u0BFF\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 80) || "notes";
}

export function exportPdf(title: string, html: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) throw new Error("Popup blocked — allow popups to export as PDF.");
  w.document.write(wrapDocument(title, html));
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 500);
}

/** Word-compatible .doc(x-style) HTML package — opens fully editable in Word/Google Docs. */
export function exportDocx(title: string, html: string) {
  const head = `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->`;
  const doc = wrapDocument(title, html, head).replace(
    "<html>",
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">',
  );
  download(
    new Blob(["\ufeff", doc], { type: "application/msword" }),
    `${safeFileName(title)}.doc`,
  );
}

export function exportHtml(title: string, html: string) {
  download(new Blob([wrapDocument(title, html)], { type: "text/html;charset=utf-8" }), `${safeFileName(title)}.html`);
}

export function htmlToPlainText(html: string) {
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("svg").forEach((el) => el.replaceWith("[diagram]"));
  div.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  div.querySelectorAll("li").forEach((el) => (el.textContent = `• ${el.textContent}\n`));
  div.querySelectorAll("h1,h2,h3,h4,p,tr,pre,blockquote,div").forEach((el) => el.append("\n"));
  return (div.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

export function exportTxt(title: string, html: string) {
  download(
    new Blob([`${title}\n${"=".repeat(title.length)}\n\n${htmlToPlainText(html)}`], {
      type: "text/plain;charset=utf-8",
    }),
    `${safeFileName(title)}.txt`,
  );
}
