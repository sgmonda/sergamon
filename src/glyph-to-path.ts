/**
 * Converts an array of merged rectangles into an opentype.js Path object.
 *
 * Coordinate system:
 *   - In font units, y=0 is the baseline.
 *   - Row 0 of the pixel grid is at the top of the em square.
 *   - fontY = (baselineRow - row) * pixelSize   (top edge of a pixel row)
 *   - fontX = col * pixelSize                    (left edge of a pixel column)
 *   - Each rectangle becomes a clockwise closed sub-path.
 *
 * Uses opentype.js v1.3.4 API:
 *   new opentype.Path(), path.moveTo(), path.lineTo(), path.closePath()
 *
 * Usage:
 *   import { glyphToPath } from './glyph-to-path.js';
 *   const path = glyphToPath(rects, 120, 13);
 */

import opentype from "opentype.js";
import type { Rectangle } from "./types.js";

/**
 * Convert an array of rectangles (in pixel-grid coordinates) into a single
 * opentype.js Path in font-unit coordinates.
 *
 * @param rects - Merged rectangles from optimizeGrid().
 * @param pixelSize - Size of one pixel in font units (e.g. 120).
 * @param baselineRow - Row index of the baseline (0-based from top, e.g. 13).
 * @returns An opentype.Path containing all rectangle sub-paths.
 */
export function glyphToPath(
  rects: Rectangle[],
  pixelSize: number,
  baselineRow: number,
): opentype.Path {
  const path = new opentype.Path();

  for (const rect of rects) {
    // Top-left corner in font units
    const x0 = rect.x * pixelSize;
    const y0 = (baselineRow - rect.y) * pixelSize;

    // Bottom-right corner in font units
    const x1 = (rect.x + rect.w) * pixelSize;
    const y1 = (baselineRow - (rect.y + rect.h)) * pixelSize;

    // Clockwise winding: top-left -> top-right -> bottom-right -> bottom-left
    path.moveTo(x0, y0);
    path.lineTo(x1, y0);
    path.lineTo(x1, y1);
    path.lineTo(x0, y1);
    path.closePath();
  }

  return path;
}
