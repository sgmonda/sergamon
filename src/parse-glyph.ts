/**
 * Parser for .glyph source files.
 *
 * A .glyph file consists of:
 *   - Header lines starting with '#' (label, codepoint, weight, optional components)
 *   - An empty separator line
 *   - Grid lines using '.' (empty) and 'X' (filled)
 *
 * Usage:
 *   import { parseGlyph, parseAllGlyphs } from './parse-glyph.js';
 *   const glyph = await parseGlyph('/path/to/U+0041_A.glyph');
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { GlyphHeader, ParsedGlyph } from "./types.js";

// ── Header parsing ──────────────────────────────────────────────────────────

/**
 * Parse the header comment lines into a GlyphHeader.
 *
 * Expected patterns:
 *   # A (U+0041)
 *   # weight: regular
 *   # components: equal greater      (ligatures only)
 *
 *   # => (ligature)
 *   # weight: regular
 *   # components: equal greater
 */
function parseHeader(headerLines: string[], filePath: string): GlyphHeader {
  let label: string | undefined;
  let codepoint: number | undefined;
  let weight: "regular" | "bold" | undefined;
  let components: string[] | undefined;

  for (const raw of headerLines) {
    // Strip the leading '#' and trim whitespace
    const line = raw.replace(/^#\s*/, "").trim();
    if (line === "") continue;

    // Match "weight: regular" or "weight: bold"
    const weightMatch = line.match(/^weight:\s*(regular|bold)$/i);
    if (weightMatch) {
      weight = weightMatch[1].toLowerCase() as "regular" | "bold";
      continue;
    }

    // Match "components: equal greater ..."
    const componentsMatch = line.match(/^components:\s+(.+)$/i);
    if (componentsMatch) {
      components = componentsMatch[1].trim().split(/\s+/);
      continue;
    }

    // First non-field header line is the label line.
    // Patterns:
    //   "A (U+0041)"
    //   "space (U+0020)"
    //   "=> (ligature)"
    if (label === undefined) {
      const codepointMatch = line.match(
        /^(.+?)\s+\(U\+([0-9A-Fa-f]{4,6})\)$/,
      );
      if (codepointMatch) {
        label = codepointMatch[1].trim();
        codepoint = parseInt(codepointMatch[2], 16);
      } else {
        // Ligature or other label without a codepoint (e.g. "=> (ligature)")
        const ligatureMatch = line.match(/^(.+?)\s+\(ligature\)$/i);
        if (ligatureMatch) {
          label = ligatureMatch[1].trim();
        } else {
          // Fallback: entire line is the label
          label = line;
        }
      }
    }
  }

  // Fallback label from filename if header had none
  if (label === undefined) {
    const basename = path.basename(filePath, ".glyph");
    // Strip U+XXXX_ prefix or LIG_ prefix
    label = basename.replace(/^U\+[0-9A-Fa-f]+_/, "").replace(/^LIG_/, "");
  }

  // Default weight
  if (weight === undefined) {
    weight = "regular";
  }

  // Try to extract codepoint from filename if not found in header
  if (codepoint === undefined && components === undefined) {
    const basename = path.basename(filePath, ".glyph");
    const filenameMatch = basename.match(/^U\+([0-9A-Fa-f]{4,6})_/);
    if (filenameMatch) {
      codepoint = parseInt(filenameMatch[1], 16);
    }
  }

  return { label: label!, codepoint, weight, components };
}

// ── Grid parsing ────────────────────────────────────────────────────────────

/**
 * Convert grid text lines into a boolean[][] matrix.
 * '.' maps to false, 'X' maps to true.
 */
function parseGrid(gridLines: string[]): boolean[][] {
  return gridLines.map((line) =>
    [...line].map((ch) => ch === "X"),
  );
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse a single .glyph file and return a ParsedGlyph.
 */
export async function parseGlyph(filePath: string): Promise<ParsedGlyph> {
  const absolutePath = path.resolve(filePath);
  const content = await fs.readFile(absolutePath, "utf-8");

  const lines = content.split("\n");

  // Remove trailing empty line produced by final newline
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const headerLines: string[] = [];
  const gridLines: string[] = [];
  let inGrid = false;

  for (const line of lines) {
    if (!inGrid) {
      if (line.startsWith("#")) {
        headerLines.push(line);
      } else if (line.trim() === "") {
        // Empty line separates header from grid (only relevant before grid starts)
        // If we already have header lines, the next non-empty line starts the grid.
        continue;
      } else {
        // First non-comment, non-empty line starts the grid
        inGrid = true;
        gridLines.push(line);
      }
    } else {
      gridLines.push(line);
    }
  }

  const header = parseHeader(headerLines, absolutePath);
  const grid = parseGrid(gridLines);
  const height = grid.length;
  const width = height > 0 ? grid[0].length : 0;

  return {
    header,
    grid,
    filePath: absolutePath,
    width,
    height,
  };
}

/**
 * Parse all .glyph files found in the given directories (non-recursive).
 * Returns an array of ParsedGlyph sorted by file path.
 */
export async function parseAllGlyphs(
  glyphDirs: string[],
): Promise<ParsedGlyph[]> {
  const glyphFiles: string[] = [];

  for (const dir of glyphDirs) {
    const resolvedDir = path.resolve(dir);
    let entries: string[];
    try {
      entries = await fs.readdir(resolvedDir);
    } catch {
      // Directory may not exist yet; skip silently
      continue;
    }
    for (const entry of entries) {
      if (entry.endsWith(".glyph")) {
        glyphFiles.push(path.join(resolvedDir, entry));
      }
    }
  }

  glyphFiles.sort();

  const results = await Promise.all(glyphFiles.map((f) => parseGlyph(f)));
  return results;
}
