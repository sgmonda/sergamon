/**
 * Generate glyph files for the Tags Block: U+E0000–U+E007F (128 chars).
 *
 * Design: tag bracket frame (< > on edges) with miniature ASCII character inside.
 * Each tag codepoint maps to ASCII: asciiCode = codepoint - 0xE0000.
 * Control chars (0x00-0x1F, 0x7F) use caret notation (^@, ^A, etc.).
 */

import fs from "fs";
import path from "path";
import { emptyGrid, stampChar, formatGlyph } from "./mini-font.js";

const OUT_DIR = path.join(import.meta.dirname, "..", "glyphs", "invisible-indicators");

// Tag bracket frame: < on left edge, > on right edge
function addTagFrame(grid: string[]): void {
  // Left bracket < at col 0
  const setPixel = (row: string, col: number): string => {
    const chars = row.split('');
    chars[col] = 'X';
    return chars.join('');
  };

  grid[3] = setPixel(grid[3], 2);
  grid[4] = setPixel(grid[4], 1);
  grid[5] = setPixel(grid[5], 0);
  grid[6] = setPixel(grid[6], 1);
  grid[7] = setPixel(grid[7], 2);

  // Right bracket > at col 7
  grid[3] = setPixel(grid[3], 5);
  grid[4] = setPixel(grid[4], 6);
  grid[5] = setPixel(grid[5], 7);
  grid[6] = setPixel(grid[6], 6);
  grid[7] = setPixel(grid[7], 5);
}

// Tag names per Unicode standard
const TAG_NAMES: Record<number, string> = {
  0x00: 'tagNUL', 0x01: 'tagSOH', 0x02: 'tagSTX', 0x03: 'tagETX',
  0x04: 'tagEOT', 0x05: 'tagENQ', 0x06: 'tagACK', 0x07: 'tagBEL',
  0x08: 'tagBS',  0x09: 'tagHT',  0x0A: 'tagLF',  0x0B: 'tagVT',
  0x0C: 'tagFF',  0x0D: 'tagCR',  0x0E: 'tagSO',  0x0F: 'tagSI',
  0x10: 'tagDLE', 0x11: 'tagDC1', 0x12: 'tagDC2', 0x13: 'tagDC3',
  0x14: 'tagDC4', 0x15: 'tagNAK', 0x16: 'tagSYN', 0x17: 'tagETB',
  0x18: 'tagCAN', 0x19: 'tagEM',  0x1A: 'tagSUB', 0x1B: 'tagESC',
  0x1C: 'tagFS',  0x1D: 'tagGS',  0x1E: 'tagRS',  0x1F: 'tagUS',
  0x20: 'tagspace',
  0x7F: 'tagDEL',
};

// Characters that are unsafe or ambiguous in filenames
const FILENAME_MAP: Record<number, string> = {
  0x2F: 'tagslash', 0x5C: 'tagbackslash', 0x3A: 'tagcolon',
  0x2A: 'tagasterisk', 0x3F: 'tagquestion', 0x22: 'tagdoublequote',
  0x3C: 'taglessthan', 0x3E: 'taggreaterthan', 0x7C: 'tagpipe',
  0x27: 'tagapostrophe', 0x60: 'tagbacktick',
};

function getTagLabel(asciiCode: number): string {
  if (TAG_NAMES[asciiCode]) return TAG_NAMES[asciiCode];
  if (FILENAME_MAP[asciiCode]) return FILENAME_MAP[asciiCode];
  const ch = String.fromCharCode(asciiCode);
  return `tag${ch}`;
}

function generateTag(codepoint: number, asciiCode: number): string {
  const grid = emptyGrid();
  addTagFrame(grid);

  if (asciiCode >= 0x21 && asciiCode <= 0x7E) {
    // Printable ASCII: render the character in mini-font centered
    const ch = String.fromCharCode(asciiCode);
    stampChar(grid, ch, 9, 2);
  } else if (asciiCode <= 0x1F) {
    // Control chars: caret notation ^X
    stampChar(grid, '^', 9, 1);
    const caretChar = String.fromCharCode(0x40 + asciiCode); // ^@ ^A ^B ...
    stampChar(grid, caretChar, 9, 4);
  } else if (asciiCode === 0x20) {
    // Space: show SP
    stampChar(grid, 'S', 9, 1);
    stampChar(grid, 'P', 9, 4);
  } else if (asciiCode === 0x7F) {
    // DEL: show ^?
    stampChar(grid, '^', 9, 1);
    stampChar(grid, '?', 9, 4);
  }

  const label = getTagLabel(asciiCode);
  return formatGlyph(label, codepoint, grid);
}

for (let i = 0; i <= 0x7F; i++) {
  const cp = 0xE0000 + i;
  const hex = cp.toString(16).toUpperCase().padStart(5, '0');
  const content = generateTag(cp, i);
  const filename = `U+${hex}_${getTagLabel(i)}.glyph`;
  fs.writeFileSync(path.join(OUT_DIR, filename), content);
}

console.log("Generated 128 tags block glyphs.");
