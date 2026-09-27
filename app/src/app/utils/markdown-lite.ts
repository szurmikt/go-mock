/**
 * Converts the app's own constrained markdown subset — "- " bullet lines, **bold**, *italic* —
 * into HTML. Built for tip-card body copy specifically: short, author-controlled text with no
 * need for headings, links, or nested lists. Escapes `&`/`<`/`>` before inserting any markup,
 * so a stray literal "<" in translated copy can't break the output or inject arbitrary tags —
 * this is what makes it safe to render via [innerHTML] with the Angular sanitizer bypassed
 * (see MarkdownLitePipe).
 */
export function markdownLiteToHtml(text: string): string {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(`<ul style="margin: 4px 0 8px; padding-left: 20px">${listItems.join('')}</ul>`);
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    const isBullet = line.startsWith('- ');
    const content = formatInline(isBullet ? line.slice(2) : line);
    if (isBullet) {
      listItems.push(`<li style="margin-bottom: 4px">${content}</li>`);
    } else {
      flushList();
      blocks.push(`<p style="margin: 0 0 8px">${content}</p>`);
    }
  }
  flushList();

  return blocks.join('');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 800; color: var(--ink)">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}
