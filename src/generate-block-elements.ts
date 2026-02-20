/**
 * Generate block element .glyph files for Sergamon font.
 *
 * Generates 14 glyphs in glyphs/block-elements/:
 * U+2580-U+2593 (upper/lower blocks, left/right halves, shade patterns)
 */

import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const OUTPUT_DIR = path.join(PROJECT_ROOT, "glyphs", "block-elements");

const COLS = 8;
const ROWS = 16;

interface BlockDef {
  codepoint: number;
  name: string;
  fill: (row: number, col: number) => boolean;
}

const blocks: BlockDef[] = [
  {
    codepoint: 0x2580,
    name: "upperhalf",
    fill: (row) => row < 8,
  },
  {
    codepoint: 0x2581,
    name: "loweroneeighth",
    fill: (row) => row >= 14,
  },
  {
    codepoint: 0x2582,
    name: "loweronequarter",
    fill: (row) => row >= 12,
  },
  {
    codepoint: 0x2583,
    name: "lowerthreeeighths",
    fill: (row) => row >= 10,
  },
  {
    codepoint: 0x2584,
    name: "lowerhalf",
    fill: (row) => row >= 8,
  },
  {
    codepoint: 0x2585,
    name: "lowerfiveeighths",
    fill: (row) => row >= 6,
  },
  {
    codepoint: 0x2586,
    name: "lowerthreequarters",
    fill: (row) => row >= 4,
  },
  {
    codepoint: 0x2587,
    name: "lowerseveneighths",
    fill: (row) => row >= 2,
  },
  {
    codepoint: 0x2588,
    name: "fullblock",
    fill: () => true,
  },
  {
    codepoint: 0x258c,
    name: "lefthalf",
    fill: (_row, col) => col < 4,
  },
  {
    codepoint: 0x2590,
    name: "righthalf",
    fill: (_row, col) => col >= 4,
  },
  {
    codepoint: 0x2591,
    name: "lightshade",
    fill: (row, col) => (row + col) % 4 === 0,
  },
  {
    codepoint: 0x2592,
    name: "mediumshade",
    fill: (row, col) => (row + col) % 2 === 0,
  },
  {
    codepoint: 0x2593,
    name: "darkshade",
    fill: (row, col) => (row + col) % 2 !== 0,
  },
];

function generateGlyph(def: BlockDef): string {
  const cpHex = def.codepoint.toString(16).toUpperCase().padStart(4, "0");
  const lines: string[] = [];

  lines.push(`# ${def.name} (U+${cpHex})`);
  lines.push("");

  for (let row = 0; row < ROWS; row++) {
    let rowStr = "";
    for (let col = 0; col < COLS; col++) {
      rowStr += def.fill(row, col) ? "X" : ".";
    }
    lines.push(rowStr);
  }

  return lines.join("\n") + "\n";
}

function main(): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let count = 0;
  for (const def of blocks) {
    const cpHex = def.codepoint.toString(16).toUpperCase().padStart(4, "0");
    const filename = `U+${cpHex}_${def.name}.glyph`;
    const filePath = path.join(OUTPUT_DIR, filename);
    const content = generateGlyph(def);
    fs.writeFileSync(filePath, content, "utf-8");
    count++;
  }

  console.log(`Generated ${count} block element glyphs in ${OUTPUT_DIR}`);
}

main();
