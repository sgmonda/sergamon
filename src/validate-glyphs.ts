/**
 * Glyph validator for the Sergamon pixel font.
 *
 * Validates every .glyph file in the glyphs/ directories and exits with
 * a non-zero code if any errors are found.
 *
 * Run:  tsx src/validate-glyphs.ts
 */

import fs from "node:fs";
import path from "node:path";
import { parseAllGlyphs } from "./parse-glyph.js";
import type { FontConfig, ParsedGlyph } from "./types.js";

// ── Configuration ───────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);

const GLYPH_DIRS = [
  path.join(PROJECT_ROOT, "glyphs", "ascii"),
  path.join(PROJECT_ROOT, "glyphs", "latin-ext"),
  path.join(PROJECT_ROOT, "glyphs", "arrows"),
  path.join(PROJECT_ROOT, "glyphs", "box-drawing"),
  path.join(PROJECT_ROOT, "glyphs", "block-elements"),
  path.join(PROJECT_ROOT, "glyphs", "geometric"),
  path.join(PROJECT_ROOT, "glyphs", "symbols"),
  path.join(PROJECT_ROOT, "glyphs", "currency"),
  path.join(PROJECT_ROOT, "glyphs", "math"),
  path.join(PROJECT_ROOT, "glyphs", "greek"),
  path.join(PROJECT_ROOT, "glyphs", "powerline"),
  path.join(PROJECT_ROOT, "glyphs", "braille"),
  path.join(PROJECT_ROOT, "glyphs", "keyboard"),
  path.join(PROJECT_ROOT, "glyphs", "cyrillic"),
  path.join(PROJECT_ROOT, "glyphs", "punctuation"),
  path.join(PROJECT_ROOT, "glyphs", "latin-ext-b"),
  path.join(PROJECT_ROOT, "glyphs", "combining"),
  path.join(PROJECT_ROOT, "glyphs", "georgian"),
  path.join(PROJECT_ROOT, "glyphs", "thai"),
  path.join(PROJECT_ROOT, "glyphs", "devanagari"),
  path.join(PROJECT_ROOT, "glyphs", "invisible-indicators"),
];

const CONFIG_PATH = path.join(PROJECT_ROOT, "font-config.json");

// ASCII printable range U+0020 through U+007E (95 codepoints)
const ASCII_START = 0x0020;
const ASCII_END = 0x007e;

// ── Canonical horizontal axis ───────────────────────────────────────────────
//
// Lines, arrows and dashes all sit on one horizontal axis so that a run like
// `──→` joins into a continuous line instead of stepping where the line meets
// the arrow. The axis is the boundary between rows 8 and 9, which is also
// where the bars of `-`, `+` and `=` sit.
//
// A stroke centred on that boundary mirrors around it, so row r pairs with
// row AXIS_ROW_SUM - r: a 2px stroke is rows 8-9, a 4px heavy stroke is rows
// 7-10, and a double stroke is rows 6-7 plus 10-11.
const AXIS_ROW_SUM = 17;

const BOX_DRAWING_START = 0x2500;
const BOX_DRAWING_END = 0x257f;
const ARROWS_START = 0x2190;
const ARROWS_END = 0x21ff;

// Arrows whose full-width row is a base or a curve rather than a horizontal
// stem, so the axis does not apply to them.
const AXIS_EXEMPT_ARROWS = new Set([
  0x21a5, // ↥ upwards arrow from bar — the full row is the bar
  0x21a7, // ↧ downwards arrow from bar
  0x21a8, // ↨ up down arrow with base
  0x21ab, // ↫ leftwards arrow with loop
  0x21ac, // ↬ rightwards arrow with loop
  0x21b5, // ↵ downwards arrow with corner leftwards
  0x21b8, // ↸ north west arrow to long bar
  0x21ea, // ⇪ upwards white arrow from bar
]);

// Dashes are the same stroke at different lengths; they share the axis too.
const DASH_CODEPOINTS = new Set([
  0x002d, // - hyphen-minus
  0x2010, // ‐ hyphen
  0x2011, // ‑ non-breaking hyphen
  0x2013, // – en dash
  0x2014, // — em dash
  0x2015, // ― horizontal bar
  0x2212, // − minus sign
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

interface ValidationError {
  file: string;
  message: string;
}

function formatCodepoint(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

function relativeToProject(absPath: string): string {
  return path.relative(PROJECT_ROOT, absPath);
}

/** Rows holding a wide stroke that reaches a side edge, so it joins the next cell. */
function connectingRows(grid: boolean[][]): number[] {
  const rows: number[] = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    const filled = row.filter(Boolean).length;
    if (filled >= 5 && (row[0] || row[row.length - 1])) rows.push(r);
  }
  return rows;
}

/** Rows filled edge to edge. */
function fullRows(grid: boolean[][]): number[] {
  const rows: number[] = [];
  for (let r = 0; r < grid.length; r++) {
    if (grid[r].every(Boolean)) rows.push(r);
  }
  return rows;
}

function isContiguous(rows: number[]): boolean {
  return rows.length > 0 && rows[rows.length - 1] - rows[0] === rows.length - 1;
}

// ── Validation rules ────────────────────────────────────────────────────────

function validateGlyphs(
  glyphs: ParsedGlyph[],
  config: FontConfig,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const { width: stdWidth, height: stdHeight } = config.grid;

  const codepointToGlyph = new Map<number, ParsedGlyph>();
  const codepointOccurrences = new Map<number, ParsedGlyph[]>();

  for (const g of glyphs) {
    if (g.header.codepoint !== undefined) {
      const cp = g.header.codepoint;
      if (!codepointOccurrences.has(cp)) {
        codepointOccurrences.set(cp, []);
      }
      codepointOccurrences.get(cp)!.push(g);
      codepointToGlyph.set(cp, g);
    }
  }

  for (const glyph of glyphs) {
    const rel = relativeToProject(glyph.filePath);

    // ── 1. Grid height must be exactly 16 rows ──────────────────────────
    if (glyph.height !== stdHeight) {
      errors.push({
        file: rel,
        message: `Grid has ${glyph.height} rows, expected ${stdHeight}.`,
      });
    }

    // ── 2. Grid width ──────────────────────────────────────────────────
    if (glyph.width !== stdWidth) {
      errors.push({
        file: rel,
        message: `Grid width is ${glyph.width}, expected ${stdWidth}.`,
      });
    }

    // ── 3. All rows must have consistent width ─────────────────────────
    const expectedRowWidth = stdWidth;

    for (let row = 0; row < glyph.grid.length; row++) {
      if (glyph.grid[row].length !== expectedRowWidth) {
        errors.push({
          file: rel,
          message: `Row ${row + 1} has ${glyph.grid[row].length} columns, expected ${expectedRowWidth}.`,
        });
      }
    }

    // ── 4. Grid characters: only '.' and 'X' are valid ─────────────────
    // We re-read the raw file to check for invalid characters in the grid.
    // The parser already converted to booleans, so we verify from source.
    try {
      const content = fs.readFileSync(glyph.filePath, "utf-8");
      const lines = content.split("\n");
      // Remove trailing empty line
      if (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }
      let inGrid = false;
      let gridRow = 0;
      for (const line of lines) {
        if (!inGrid) {
          if (line.startsWith("#") || line.trim() === "") {
            continue;
          }
          inGrid = true;
        }
        if (inGrid) {
          gridRow++;
          if (!/^[.X]+$/.test(line)) {
            errors.push({
              file: rel,
              message: `Row ${gridRow} contains invalid characters. Only '.' and 'X' are allowed in the grid. Got: "${line}"`,
            });
          }
        }
      }
    } catch (err) {
      errors.push({
        file: rel,
        message: `Could not re-read file for character validation: ${err}`,
      });
    }

    // ── 5. Valid Unicode codepoint ──────────────────────────────────────
    if (glyph.header.codepoint !== undefined) {
      const cp = glyph.header.codepoint;
      if (cp < 0 || cp > 0x10ffff) {
        errors.push({
          file: rel,
          message: `Invalid Unicode codepoint ${formatCodepoint(cp)}. Must be in range U+0000 to U+10FFFF.`,
        });
      }
      // Surrogates are not valid scalar values
      if (cp >= 0xd800 && cp <= 0xdfff) {
        errors.push({
          file: rel,
          message: `Codepoint ${formatCodepoint(cp)} is in the surrogate range (U+D800-U+DFFF) and is not a valid Unicode scalar value.`,
        });
      }

      // ── 6. Canonical horizontal axis ─────────────────────────────────
      // Box-drawing: every stroke that joins the neighbouring cell must
      // mirror around the axis, or lines step where they meet.
      if (cp >= BOX_DRAWING_START && cp <= BOX_DRAWING_END) {
        const rows = connectingRows(glyph.grid);
        const offAxis = rows.filter((r) => !rows.includes(AXIS_ROW_SUM - r));
        if (offAxis.length > 0) {
          errors.push({
            file: rel,
            message: `Horizontal stroke on row(s) ${offAxis.join(", ")} is off the canonical axis. Strokes must mirror around the boundary between rows 8 and 9, so row r pairs with row ${AXIS_ROW_SUM} - r (2px stroke: rows 8-9; heavy: 7-10; double: 6-7 and 10-11).`,
          });
        }
      }

      // Arrows: a stem crossing the whole cell shares that same axis, so
      // `──→` joins up. Stems that are really a base or a curve are exempt.
      if (
        cp >= ARROWS_START &&
        cp <= ARROWS_END &&
        !AXIS_EXEMPT_ARROWS.has(cp)
      ) {
        const stem = fullRows(glyph.grid);
        if (stem.length > 0 && isContiguous(stem)) {
          const top = stem[0];
          const bottom = stem[stem.length - 1];
          if (top + bottom !== AXIS_ROW_SUM) {
            errors.push({
              file: rel,
              message: `Arrow stem spans rows ${top}-${bottom}, which is off the canonical axis. A stem crossing the cell must mirror around the boundary between rows 8 and 9 (a 2px stem is rows 8-9).`,
            });
          }
        }
      }

      // Dashes are one stroke at different lengths, all on the axis.
      if (DASH_CODEPOINTS.has(cp)) {
        const rows: number[] = [];
        for (let r = 0; r < glyph.grid.length; r++) {
          if (glyph.grid[r].some(Boolean)) rows.push(r);
        }
        const onAxis =
          rows.length === 2 && rows[0] === 8 && rows[1] === 9;
        if (!onAxis) {
          errors.push({
            file: rel,
            message: `Dash occupies row(s) ${rows.join(", ") || "none"}; dashes must be a 2px stroke on rows 8-9 so they match '-', '+' and '='. Only their length may differ.`,
          });
        }
      }
    }

  }

  // ── 7. No duplicate codepoints ────────────────────────────────────────
  for (const [cp, dups] of codepointOccurrences) {
    if (dups.length > 1) {
      const files = dups.map((g) => relativeToProject(g.filePath)).join(", ");
      errors.push({
        file: files,
        message: `Duplicate codepoint ${formatCodepoint(cp)} found in multiple files.`,
      });
    }
  }

  // ── 8. ASCII completeness (U+0020-U+007E, 95 chars) ──────────────────
  for (let cp = ASCII_START; cp <= ASCII_END; cp++) {
    if (!codepointToGlyph.has(cp)) {
      const char =
        cp >= 0x21 ? ` '${String.fromCodePoint(cp)}'` : "";
      errors.push({
        file: "glyphs/ascii/",
        message: `Missing required ASCII glyph: ${formatCodepoint(cp)}${char}.`,
      });
    }
  }

  return errors;
}

// ── CLI entry point ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Validating glyph files...\n");

  // Load font config
  let config: FontConfig;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    config = JSON.parse(raw) as FontConfig;
  } catch (err) {
    console.error(`Failed to read font config at ${CONFIG_PATH}: ${err}`);
    process.exit(1);
    return; // unreachable, helps TypeScript narrow
  }

  // Parse all glyphs
  const glyphs = await parseAllGlyphs(GLYPH_DIRS);

  if (glyphs.length === 0) {
    console.warn(
      "Warning: No .glyph files found. Validation will report missing ASCII glyphs.\n",
    );
  } else {
    console.log(`Found ${glyphs.length} glyph file(s).\n`);
  }

  // Validate
  const errors = validateGlyphs(glyphs, config);

  if (errors.length === 0) {
    console.log("All glyphs are valid.");
    process.exit(0);
  }

  // Report errors
  console.error(`Found ${errors.length} validation error(s):\n`);
  for (const err of errors) {
    console.error(`  [${err.file}] ${err.message}`);
  }
  console.error("");
  process.exit(1);
}

main();
