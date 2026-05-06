/**
 * Quick round-trip inspection: parse a font with opentype.js and print key
 * metrics + a few sample glyphs. Used as a sanity check after the TT/OTF build.
 *
 * Usage:  tsx scripts/inspect-font.ts <font>
 */

import opentype from "opentype.js";
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: tsx scripts/inspect-font.ts <font>");
  process.exit(2);
}

const buf = fs.readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const font = opentype.parse(ab);

console.log(`File: ${file}`);
console.log(`  outlinesFormat: ${(font as any).outlinesFormat}`);
console.log(`  numGlyphs: ${font.glyphs.length}`);
console.log(`  unitsPerEm: ${font.unitsPerEm}`);
console.log(`  ascender: ${font.ascender}, descender: ${font.descender}`);

const samples = ["A", "0", "@", "í", "→", "█"];
for (const ch of samples) {
  const cp = ch.codePointAt(0)!;
  const idx = font.charToGlyphIndex(ch);
  const g = font.glyphs.get(idx);
  const cmds = (g.path as any)?.commands?.length ?? 0;
  let bbStr = "";
  if (cmds > 0) {
    const bb = g.getBoundingBox();
    bbStr = ` bbox=[${bb.x1},${bb.y1},${bb.x2},${bb.y2}]`;
  }
  console.log(
    `  U+${cp.toString(16).toUpperCase().padStart(4, "0")} '${ch}': idx=${idx} name=${g.name} cmds=${cmds}${bbStr}`,
  );
}
