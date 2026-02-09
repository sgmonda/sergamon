/**
 * Greedy row-merge algorithm for converting a boolean[][] pixel grid
 * into an array of merged rectangles.
 *
 * This reduces the number of path commands in the final font by merging
 * horizontally adjacent filled pixels into row-spans, then merging
 * vertically adjacent spans of the same x-range into larger rectangles.
 *
 * Usage:
 *   import { optimizeGrid } from './optimize-paths.js';
 *   const rects = optimizeGrid(grid);
 */

import type { Rectangle } from "./types.js";

// ── Internal types ──────────────────────────────────────────────────────────

/** A horizontal span of filled pixels within a single row. */
interface RowSpan {
  /** Column of the leftmost pixel. */
  x: number;
  /** Row index. */
  y: number;
  /** Number of consecutive filled pixels. */
  w: number;
}

// ── Step 1: Horizontal merge ────────────────────────────────────────────────

/**
 * Scan a single row left-to-right and merge horizontally adjacent filled
 * pixels into RowSpans.
 */
function extractRowSpans(row: boolean[], rowIndex: number): RowSpan[] {
  const spans: RowSpan[] = [];
  let col = 0;

  while (col < row.length) {
    if (row[col]) {
      const startCol = col;
      while (col < row.length && row[col]) {
        col++;
      }
      spans.push({ x: startCol, y: rowIndex, w: col - startCol });
    } else {
      col++;
    }
  }

  return spans;
}

// ── Step 2: Vertical merge ──────────────────────────────────────────────────

/**
 * Merge vertically adjacent row-spans that share the same x and w into
 * taller rectangles.
 */
function mergeSpansVertically(allSpans: RowSpan[]): Rectangle[] {
  // Group spans by their (x, w) key so we can quickly find candidates
  // for vertical merging.
  const byKey = new Map<string, RowSpan[]>();

  for (const span of allSpans) {
    const key = `${span.x}:${span.w}`;
    if (!byKey.has(key)) {
      byKey.set(key, []);
    }
    byKey.get(key)!.push(span);
  }

  const rects: Rectangle[] = [];

  for (const [, spans] of byKey) {
    // Sort by row so we can merge consecutive rows.
    spans.sort((a, b) => a.y - b.y);

    let i = 0;
    while (i < spans.length) {
      const start = spans[i];
      let height = 1;

      // Extend downward while the next span is on the immediately following row.
      while (
        i + height < spans.length &&
        spans[i + height].y === start.y + height
      ) {
        height++;
      }

      rects.push({
        x: start.x,
        y: start.y,
        w: start.w,
        h: height,
      });

      i += height;
    }
  }

  return rects;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert a boolean[][] pixel grid into an optimized array of rectangles.
 *
 * Algorithm:
 *   1. Scan each row left-to-right, merging adjacent filled pixels into
 *      horizontal spans.
 *   2. Merge vertically adjacent spans that share the same x and width
 *      into taller rectangles.
 *
 * @param grid - grid[row][col] is true for filled pixels.
 * @returns Array of merged rectangles covering all filled pixels.
 */
export function optimizeGrid(grid: boolean[][]): Rectangle[] {
  // Step 1: collect all horizontal row-spans.
  const allSpans: RowSpan[] = [];

  for (let row = 0; row < grid.length; row++) {
    const spans = extractRowSpans(grid[row], row);
    allSpans.push(...spans);
  }

  if (allSpans.length === 0) {
    return [];
  }

  // Step 2: merge vertically.
  return mergeSpansVertically(allSpans);
}
