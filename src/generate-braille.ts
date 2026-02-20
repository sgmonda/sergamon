/**
 * Generate all 256 Braille pattern .glyph files for Sergamon font.
 *
 * Braille patterns U+2800 to U+28FF.
 * Each codepoint U+2800+N encodes 8 dots via bitmask in a 2x4 dot grid.
 *
 * Dot layout:
 *   dot1  dot4
 *   dot2  dot5
 *   dot3  dot6
 *   dot7  dot8
 *
 * Each dot renders as a 2x2 pixel block in the 8x16 glyph grid.
 */

import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const OUTPUT_DIR = path.join(PROJECT_ROOT, "glyphs", "braille");

const COLS = 8;
const ROWS = 16;

// Bit positions for each dot
const DOT_BITS = {
  dot1: 0x01,
  dot2: 0x02,
  dot3: 0x04,
  dot4: 0x08,
  dot5: 0x10,
  dot6: 0x20,
  dot7: 0x40,
  dot8: 0x80,
};

// Each dot maps to a 2x2 block at specific (row, col) positions
// Left column dots: cols 1-2, right column dots: cols 5-6
const DOT_POSITIONS: { bit: number; rows: [number, number]; cols: [number, number] }[] = [
  { bit: DOT_BITS.dot1, rows: [3, 4], cols: [1, 2] },
  { bit: DOT_BITS.dot2, rows: [6, 7], cols: [1, 2] },
  { bit: DOT_BITS.dot3, rows: [9, 10], cols: [1, 2] },
  { bit: DOT_BITS.dot4, rows: [3, 4], cols: [5, 6] },
  { bit: DOT_BITS.dot5, rows: [6, 7], cols: [5, 6] },
  { bit: DOT_BITS.dot6, rows: [9, 10], cols: [5, 6] },
  { bit: DOT_BITS.dot7, rows: [12, 13], cols: [1, 2] },
  { bit: DOT_BITS.dot8, rows: [12, 13], cols: [5, 6] },
];

function brailleName(offset: number): string {
  // Unicode standard names: "braille pattern blank", "braille pattern dots-1", etc.
  if (offset === 0) return "brailleblank";

  const dots: number[] = [];
  for (let bit = 0; bit < 8; bit++) {
    if (offset & (1 << bit)) {
      dots.push(bit + 1);
    }
  }
  return `braille${dots.join("")}`;
}

function generateBrailleGlyph(offset: number): string {
  const codepoint = 0x2800 + offset;
  const cpHex = codepoint.toString(16).toUpperCase().padStart(4, "0");
  const name = brailleName(offset);

  // Build empty grid
  const grid: boolean[][] = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push(new Array(COLS).fill(false));
  }

  // Fill in active dots
  for (const dot of DOT_POSITIONS) {
    if (offset & dot.bit) {
      for (const r of dot.rows) {
        for (const c of dot.cols) {
          grid[r][c] = true;
        }
      }
    }
  }

  // Build file content
  const lines: string[] = [];
  lines.push(`# ${name} (U+${cpHex})`);
  lines.push("");

  for (let r = 0; r < ROWS; r++) {
    lines.push(grid[r].map((v) => (v ? "X" : ".")).join(""));
  }

  return lines.join("\n") + "\n";
}

function main(): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let count = 0;
  for (let offset = 0; offset < 256; offset++) {
    const codepoint = 0x2800 + offset;
    const cpHex = codepoint.toString(16).toUpperCase().padStart(4, "0");
    const name = brailleName(offset);
    const filename = `U+${cpHex}_${name}.glyph`;
    const filePath = path.join(OUTPUT_DIR, filename);
    const content = generateBrailleGlyph(offset);
    fs.writeFileSync(filePath, content, "utf-8");
    count++;
  }

  console.log(`Generated ${count} braille pattern glyphs in ${OUTPUT_DIR}`);
}

main();
