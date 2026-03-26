/**
 * Generate glyph files for Variation Selectors:
 * - U+FE00–U+FE0F  (VS1–VS16)
 * - U+E0100–U+E01EF (VS17–VS256)
 *
 * Design: dotted corner frame, "V" in top half, hex index in bottom half.
 */

import fs from "fs";
import path from "path";
import { emptyGrid, stampChar, addCornerFrame, formatGlyph } from "./mini-font.js";

const OUT_DIR = path.join(import.meta.dirname, "..", "glyphs", "invisible-indicators");

function generateVS(codepoint: number, vsNumber: number): string {
  const grid = emptyGrid();
  addCornerFrame(grid);

  // "V" centered at row 3, col 2
  stampChar(grid, 'V', 3, 2);

  if (vsNumber <= 16) {
    // Single hex digit: index 0-F (VS1=0, VS16=F)
    const hexDigit = (vsNumber - 1).toString(16).toUpperCase();
    stampChar(grid, hexDigit, 9, 2);
  } else {
    // Two hex digits for VS17-VS256
    // VS17 = index 10, VS256 = index EF
    const hexStr = (vsNumber - 1).toString(16).toUpperCase().padStart(2, '0');
    stampChar(grid, hexStr[0], 9, 1);
    stampChar(grid, hexStr[1], 9, 4);
  }

  const label = `variationselector${vsNumber}`;
  return formatGlyph(label, codepoint, grid);
}

// VS1–VS16: U+FE00–U+FE0F
for (let i = 0; i < 16; i++) {
  const cp = 0xFE00 + i;
  const vsNum = i + 1;
  const hex = cp.toString(16).toUpperCase().padStart(4, '0');
  const content = generateVS(cp, vsNum);
  const filename = `U+${hex}_variationselector${vsNum}.glyph`;
  fs.writeFileSync(path.join(OUT_DIR, filename), content);
}

// VS17–VS256: U+E0100–U+E01EF
for (let i = 0; i < 240; i++) {
  const cp = 0xE0100 + i;
  const vsNum = 17 + i;
  const hex = cp.toString(16).toUpperCase().padStart(5, '0');
  const content = generateVS(cp, vsNum);
  const filename = `U+${hex}_variationselector${vsNum}.glyph`;
  fs.writeFileSync(path.join(OUT_DIR, filename), content);
}

console.log("Generated 256 variation selector glyphs.");
