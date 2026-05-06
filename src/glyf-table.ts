/**
 * Build the TrueType `glyf` and `loca` tables straight from optimized
 * Rectangle[] data, without going through CFF charstrings.
 *
 * Sergamon glyphs are unions of axis-aligned rectangles with no curves and no
 * overlap. Every rectangle becomes one closed contour of four on-curve points
 * (top-left → top-right → bottom-right → bottom-left), which matches the
 * clockwise winding TrueType expects for filled outer contours.
 *
 * The loca table is emitted in long format (head.indexToLocFormat = 1), so
 * glyph data does not need internal padding.
 */

import type { Rectangle } from "./types.js";

export interface GlyfBuildInput {
  /** Rectangles for each glyph, indexed in the same order as the final font's
   *  glyph table (index 0 must be .notdef). */
  rectsPerGlyph: Rectangle[][];
  /** Pixel size in font units. */
  pixelSize: number;
  /** Baseline row (0-based from top of grid). */
  baselineRow: number;
}

export interface GlyfBuildResult {
  glyf: Buffer;
  loca: Buffer;
  /** Stats needed to fill maxp v1.0. */
  maxPoints: number;
  maxContours: number;
  /** Bounding box across all glyphs (font units). */
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

/** TrueType simple-glyph flag bits used here. */
const FLAG_ON_CURVE = 0x01;

/**
 * Encode one glyph's bytes. Returns an empty Buffer for glyphs with no
 * rectangles — the spec represents empty glyphs by having two consecutive
 * loca entries point to the same offset, with zero glyf bytes between.
 */
function encodeGlyph(
  rects: Rectangle[],
  pixelSize: number,
  baselineRow: number,
): { bytes: Buffer; xMin: number; yMin: number; xMax: number; yMax: number } {
  if (rects.length === 0) {
    return { bytes: Buffer.alloc(0), xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
  }

  // Build absolute coordinates (one rectangle = 4 points clockwise from TL).
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of rects) {
    const x0 = r.x * pixelSize;
    const y0 = (baselineRow - r.y) * pixelSize;
    const x1 = (r.x + r.w) * pixelSize;
    const y1 = (baselineRow - (r.y + r.h)) * pixelSize;
    // top-left, top-right, bottom-right, bottom-left
    xs.push(x0, x1, x1, x0);
    ys.push(y0, y0, y1, y1);
  }

  const numContours = rects.length;
  const numPoints = xs.length;

  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (let i = 0; i < numPoints; i++) {
    if (xs[i] < xMin) xMin = xs[i];
    if (xs[i] > xMax) xMax = xs[i];
    if (ys[i] < yMin) yMin = ys[i];
    if (ys[i] > yMax) yMax = ys[i];
  }

  // Header (10 bytes) + endPtsOfContours (2*N) + instructionLength (2)
  // + flags (1*P) + xCoords (2*P) + yCoords (2*P).
  const size = 10 + 2 * numContours + 2 + numPoints + 4 * numPoints;
  const buf = Buffer.alloc(size);
  let p = 0;

  buf.writeInt16BE(numContours, p); p += 2;
  buf.writeInt16BE(xMin, p); p += 2;
  buf.writeInt16BE(yMin, p); p += 2;
  buf.writeInt16BE(xMax, p); p += 2;
  buf.writeInt16BE(yMax, p); p += 2;

  for (let i = 0; i < numContours; i++) {
    buf.writeUInt16BE(4 * (i + 1) - 1, p);
    p += 2;
  }

  buf.writeUInt16BE(0, p); p += 2; // instructionLength

  for (let i = 0; i < numPoints; i++) {
    buf.writeUInt8(FLAG_ON_CURVE, p++);
  }

  // Coordinates are stored as deltas from the previous point.
  // First point is relative to (0, 0).
  let prevX = 0;
  for (let i = 0; i < numPoints; i++) {
    const dx = xs[i] - prevX;
    buf.writeInt16BE(dx, p); p += 2;
    prevX = xs[i];
  }
  let prevY = 0;
  for (let i = 0; i < numPoints; i++) {
    const dy = ys[i] - prevY;
    buf.writeInt16BE(dy, p); p += 2;
    prevY = ys[i];
  }

  return { bytes: buf, xMin, yMin, xMax, yMax };
}

export function buildGlyfAndLoca(input: GlyfBuildInput): GlyfBuildResult {
  const { rectsPerGlyph, pixelSize, baselineRow } = input;
  const numGlyphs = rectsPerGlyph.length;

  const glyphBuffers: Buffer[] = new Array(numGlyphs);
  const offsets: number[] = new Array(numGlyphs + 1);

  let cursor = 0;
  let maxPoints = 0;
  let maxContours = 0;
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;

  for (let i = 0; i < numGlyphs; i++) {
    offsets[i] = cursor;
    const enc = encodeGlyph(rectsPerGlyph[i], pixelSize, baselineRow);
    glyphBuffers[i] = enc.bytes;
    cursor += enc.bytes.length;

    const points = rectsPerGlyph[i].length * 4;
    const contours = rectsPerGlyph[i].length;
    if (points > maxPoints) maxPoints = points;
    if (contours > maxContours) maxContours = contours;

    if (rectsPerGlyph[i].length > 0) {
      if (enc.xMin < xMin) xMin = enc.xMin;
      if (enc.yMin < yMin) yMin = enc.yMin;
      if (enc.xMax > xMax) xMax = enc.xMax;
      if (enc.yMax > yMax) yMax = enc.yMax;
    }
  }
  offsets[numGlyphs] = cursor;

  const glyf = Buffer.concat(glyphBuffers);

  // loca long format: uint32 byte-offsets, length numGlyphs+1.
  const loca = Buffer.alloc(4 * (numGlyphs + 1));
  for (let i = 0; i <= numGlyphs; i++) {
    loca.writeUInt32BE(offsets[i], 4 * i);
  }

  // Fall back to zeros if every glyph is empty (shouldn't happen — .notdef
  // is empty but we always have at least one drawn glyph).
  if (xMin === Infinity) {
    xMin = 0; yMin = 0; xMax = 0; yMax = 0;
  }

  return { glyf, loca, maxPoints, maxContours, xMin, yMin, xMax, yMax };
}
