/* Repair HTML that was truncated mid-tag (e.g. AI output cut at the token
   limit): drop the dangling partial tag/text and close any elements left open
   so the fragment always renders cleanly instead of leaking raw markup. */

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
  // svg shape elements that never carry child content in generated diagrams
  "circle", "ellipse", "line", "path", "polygon", "polyline", "rect", "stop", "use",
]);

export function repairTruncatedHtml(input: string): string {
  let html = input;

  // 1. If the fragment ends inside a tag ("...Inspect</" or "<div class="),
  //    drop everything from that dangling "<".
  const lastOpen = html.lastIndexOf("<");
  const lastClose = html.lastIndexOf(">");
  if (lastOpen > lastClose) html = html.slice(0, lastOpen);

  // 2. Walk the tag stream with a stack and close whatever is still open.
  const stack: string[] = [];
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    const raw = match[0];
    const tag = match[1]!.toLowerCase();
    if (raw.startsWith("</")) {
      const idx = stack.lastIndexOf(tag);
      if (idx !== -1) stack.length = idx; // pop the match and anything above it
    } else if (!raw.endsWith("/>") && !VOID_TAGS.has(tag)) {
      stack.push(tag);
    }
  }
  while (stack.length > 0) html += `</${stack.pop()}>`;

  return html;
}
