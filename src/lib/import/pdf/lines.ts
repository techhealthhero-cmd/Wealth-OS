import type { PdfTextCell, PdfTextItem, PdfTextLine } from "./types";

/**
 * Groups positioned text items into visual lines, then splits each line into
 * cells wherever the horizontal gap is wider than roughly one character
 * height. Thai text is often emitted as many tiny runs (combining vowels and
 * tone marks), so very small gaps are joined without a space.
 */
export function groupTextItemsIntoLines(items: readonly PdfTextItem[]): PdfTextLine[] {
  const byPage = new Map<number, PdfTextItem[]>();
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const list = byPage.get(item.page) ?? [];
    list.push(item);
    byPage.set(item.page, list);
  }

  const lines: PdfTextLine[] = [];
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const pageItems = [...(byPage.get(page) ?? [])].sort((a, b) => b.y - a.y || a.x - b.x);
    let current: PdfTextItem[] = [];
    let currentY = 0;
    const flush = () => {
      if (current.length) lines.push(buildLine(page, currentY, current));
      current = [];
    };
    for (const item of pageItems) {
      const tolerance = Math.max(2, (item.height || 10) * 0.5);
      if (current.length && Math.abs(item.y - currentY) > tolerance) flush();
      if (!current.length) currentY = item.y;
      current.push(item);
    }
    flush();
  }
  return lines;
}

function buildLine(page: number, y: number, items: PdfTextItem[]): PdfTextLine {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const cells: PdfTextCell[] = [];
  let prev: PdfTextItem | null = null;
  for (const item of sorted) {
    const str = item.str.trim().replace(/\s+/g, " ");
    const height = item.height || 10;
    const gap = prev ? item.x - (prev.x + prev.width) : Infinity;
    const last = cells[cells.length - 1];
    if (!last || gap > height) {
      cells.push({ text: str, x: item.x, xEnd: item.x + item.width });
    } else {
      last.text += (gap > height * 0.2 ? " " : "") + str;
      last.xEnd = Math.max(last.xEnd, item.x + item.width);
    }
    prev = item;
  }
  return { page, y, text: cells.map((cell) => cell.text).join(" "), cells };
}

/** Builds text-only lines (no positions) — used by fixtures and tests. */
export function linesFromText(texts: readonly string[], page = 1): PdfTextLine[] {
  return texts.map((text, index) => ({ page, y: -index, text }));
}
