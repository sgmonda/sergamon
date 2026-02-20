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
];

const CONFIG_PATH = path.join(PROJECT_ROOT, "font-config.json");

// ASCII printable range U+0020 through U+007E (95 codepoints)
const ASCII_START = 0x0020;
const ASCII_END = 0x007e;

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
    }

  }

  // ── 6. No duplicate codepoints ────────────────────────────────────────
  for (const [cp, dups] of codepointOccurrences) {
    if (dups.length > 1) {
      const files = dups.map((g) => relativeToProject(g.filePath)).join(", ");
      errors.push({
        file: files,
        message: `Duplicate codepoint ${formatCodepoint(cp)} found in multiple files.`,
      });
    }
  }

  // ── 7. ASCII completeness (U+0020-U+007E, 95 chars) ──────────────────
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
