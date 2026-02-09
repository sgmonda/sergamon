/**
 * Type definitions for the Sergamon pixel font build pipeline.
 */

// ── Font configuration (mirrors font-config.json) ──────────────────────────

export interface FontConfigFont {
  familyName: string;
  version: string;
  description: string;
  designer: string;
  url: string;
}

export interface FontConfigGrid {
  /** Standard glyph width in pixels (8). */
  width: number;
  /** Standard glyph height in pixels (16). */
  height: number;
  /** Row index of the baseline (0-based from top). Rows above are ascender, rows at and below are descender. */
  baselineRow: number;
}

export interface FontConfigMetrics {
  /** Size of one pixel in font units. */
  pixelSize: number;
  /** Number of pixel rows above the baseline. */
  ascenderPx: number;
  /** Number of pixel rows below the baseline. */
  descenderPx: number;
  /** Extra line gap in pixel rows. */
  lineGapPx: number;
}

export interface FontConfigWeights {
  regular: number;
  bold: number;
}

export interface FontConfig {
  font: FontConfigFont;
  grid: FontConfigGrid;
  metrics: FontConfigMetrics;
  weights: FontConfigWeights;
}

// ── Parsed glyph data ───────────────────────────────────────────────────────

export interface GlyphHeader {
  /** Human-readable label, e.g. "A" or "=>" */
  label: string;
  /** Unicode codepoint as a number, e.g. 0x0041. Undefined for ligatures. */
  codepoint: number | undefined;
  /** Weight variant: "regular" or "bold". */
  weight: "regular" | "bold";
  /** For ligatures: ordered list of component glyph names that trigger the substitution. Undefined for normal glyphs. */
  components: string[] | undefined;
}

export interface ParsedGlyph {
  header: GlyphHeader;
  /** Pixel grid. grid[row][col] is true when the pixel is filled. */
  grid: boolean[][];
  /** Absolute path to the source .glyph file. */
  filePath: string;
  /** Number of pixel columns (8 for standard glyphs, 8*N for ligatures). */
  width: number;
  /** Number of pixel rows (always 16). */
  height: number;
}

// ── Build helpers ───────────────────────────────────────────────────────────

export interface Rectangle {
  /** Column offset (pixels from left). */
  x: number;
  /** Row offset (pixels from top). */
  y: number;
  /** Width in pixels. */
  w: number;
  /** Height in pixels. */
  h: number;
}

export interface FontMetrics {
  /** Units per em. */
  unitsPerEm: number;
  /** Ascender value in font units (positive). */
  ascender: number;
  /** Descender value in font units (negative). */
  descender: number;
  /** Line gap in font units. */
  lineGap: number;
  /** Advance width for every glyph in font units (monospace). */
  advanceWidth: number;
}
