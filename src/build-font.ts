/**
 * Main font build orchestrator.
 *
 * Reads glyph source files, optimizes pixel grids into vector rectangles,
 * constructs an opentype.js Font object, and exports TTF and WOFF2 files.
 *
 * Run:  tsx src/build-font.ts
 *
 * Uses opentype.js v1.3.4 (default import) and wawoff2 for WOFF2 compression.
 */

import fs from "node:fs/promises";
import path from "node:path";
import opentype from "opentype.js";
import wawoff2 from "wawoff2";
import type { FontConfig, ParsedGlyph, Rectangle } from "./types.js";
import { parseAllGlyphs } from "./parse-glyph.js";
import { optimizeGrid } from "./optimize-paths.js";
import { glyphToPath } from "./glyph-to-path.js";

// ── Constants ───────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);

const CONFIG_PATH = path.join(PROJECT_ROOT, "font-config.json");

const GLYPH_DIRS = [
  path.join(PROJECT_ROOT, "glyphs", "ascii"),
  path.join(PROJECT_ROOT, "glyphs", "latin-ext"),
];

const BUILD_DIR = path.join(PROJECT_ROOT, "build");
const SITE_FONTS_DIR = path.join(PROJECT_ROOT, "site", "fonts");

// ── Build font ─────────────────────────────────────────────────────────────

function buildGlyphs(
  parsedGlyphs: ParsedGlyph[],
  config: FontConfig,
): opentype.Glyph[] {
  const { pixelSize } = config.metrics;
  const { baselineRow, width: stdWidth } = config.grid;
  const stdAdvanceWidth = pixelSize * stdWidth;

  const results: opentype.Glyph[] = [];

  for (const pg of parsedGlyphs) {
    const rects: Rectangle[] = optimizeGrid(pg.grid);
    const glyphPath = glyphToPath(rects, pixelSize, baselineRow);

    const glyph = new opentype.Glyph({
      name: pg.header.label,
      unicode: pg.header.codepoint,
      advanceWidth: stdAdvanceWidth,
      path: glyphPath,
    });

    results.push(glyph);
  }

  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Building Sergamon font...\n");

  // 1. Read configuration.
  const configRaw = await fs.readFile(CONFIG_PATH, "utf-8");
  const config: FontConfig = JSON.parse(configRaw);

  const { pixelSize, ascenderPx, descenderPx } = config.metrics;
  const { width: stdWidth, height: stdHeight, baselineRow } = config.grid;

  const unitsPerEm = pixelSize * stdHeight;
  const ascender = pixelSize * ascenderPx;
  const descender = -(pixelSize * descenderPx);
  const stdAdvanceWidth = pixelSize * stdWidth;

  console.log(`  unitsPerEm : ${unitsPerEm}`);
  console.log(`  ascender   : ${ascender}`);
  console.log(`  descender  : ${descender}`);
  console.log(`  advanceWidth: ${stdAdvanceWidth}`);
  console.log(`  pixelSize  : ${pixelSize}`);
  console.log(`  baselineRow: ${baselineRow}\n`);

  // 2. Parse all glyph files.
  const allGlyphs = await parseAllGlyphs(GLYPH_DIRS);
  console.log(`  Parsed ${allGlyphs.length} glyph file(s).\n`);

  // 3. Build glyphs.
  console.log(`  Building font...`);

  const builtGlyphs = buildGlyphs(allGlyphs, config);

  // 4. Create .notdef glyph (empty, index 0).
  const notdefGlyph = new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: stdAdvanceWidth,
    path: new opentype.Path(),
  });

  // Assemble the glyph array: .notdef must be first.
  const glyphArray = [notdefGlyph, ...builtGlyphs];

  // 5. Build the opentype.Font.
  const font = new opentype.Font({
    familyName: config.font.familyName,
    styleName: "Regular",
    unitsPerEm: unitsPerEm,
    ascender: ascender,
    descender: descender,
    glyphs: glyphArray,
  });

  console.log(`    ${glyphArray.length} glyphs (including .notdef).`);

  // 6. Export TTF.
  await fs.mkdir(BUILD_DIR, { recursive: true });
  await fs.mkdir(SITE_FONTS_DIR, { recursive: true });

  const ttfPath = path.join(BUILD_DIR, "Sergamon.ttf");
  const woff2BuildPath = path.join(BUILD_DIR, "Sergamon.woff2");
  const woff2SitePath = path.join(SITE_FONTS_DIR, "Sergamon.woff2");

  const arrayBuffer = font.toArrayBuffer();
  const ttfBuffer = Buffer.from(arrayBuffer);
  await fs.writeFile(ttfPath, ttfBuffer);
  console.log(`    Wrote ${ttfPath}`);

  // 7. Convert to WOFF2.
  const woff2Buffer = await wawoff2.compress(ttfBuffer);
  await fs.writeFile(woff2BuildPath, woff2Buffer);
  console.log(`    Wrote ${woff2BuildPath}`);

  // 8. Copy WOFF2 to site/fonts/.
  await fs.writeFile(woff2SitePath, woff2Buffer);
  console.log(`    Wrote ${woff2SitePath}`);

  console.log("\nBuild complete.");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
