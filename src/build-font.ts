/**
 * Main font build orchestrator.
 *
 * Reads glyph source files, optimizes pixel grids into vector rectangles,
 * constructs an opentype.js Font object, registers ligature substitutions,
 * and exports TTF and WOFF2 files.
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
  path.join(PROJECT_ROOT, "glyphs", "ligatures"),
];

const BUILD_DIR = path.join(PROJECT_ROOT, "build");
const SITE_FONTS_DIR = path.join(PROJECT_ROOT, "site", "fonts");

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the component glyph names used in ligature definitions to their
 * Unicode codepoints. The component name matches the glyph label.
 */
function resolveComponentCodepoints(
  components: string[],
  labelToCodepoint: Map<string, number>,
): number[] | undefined {
  const codepoints: number[] = [];
  for (const name of components) {
    const cp = labelToCodepoint.get(name);
    if (cp === undefined) {
      console.warn(
        `  Warning: ligature component "${name}" has no known codepoint; skipping ligature.`,
      );
      return undefined;
    }
    codepoints.push(cp);
  }
  return codepoints;
}

// ── Build one weight ────────────────────────────────────────────────────────

interface BuiltGlyph {
  glyph: opentype.Glyph;
  /** For ligatures: ordered codepoints of the component glyphs. */
  ligatureComponents?: number[];
}

function buildGlyphs(
  parsedGlyphs: ParsedGlyph[],
  config: FontConfig,
  labelToCodepoint: Map<string, number>,
): BuiltGlyph[] {
  const { pixelSize } = config.metrics;
  const { baselineRow, width: stdWidth } = config.grid;
  const stdAdvanceWidth = pixelSize * stdWidth;

  const results: BuiltGlyph[] = [];

  for (const pg of parsedGlyphs) {
    const rects: Rectangle[] = optimizeGrid(pg.grid);
    const glyphPath = glyphToPath(rects, pixelSize, baselineRow);

    const isLigature = pg.header.components !== undefined;

    // Determine advance width.
    let advanceWidth: number;
    if (isLigature) {
      // Ligature width = pixelSize * ligatureWidth (which is 8 * numComponents)
      advanceWidth = pixelSize * pg.width;
    } else {
      advanceWidth = stdAdvanceWidth;
    }

    // Determine unicode value.
    const unicode = pg.header.codepoint;

    const glyph = new opentype.Glyph({
      name: pg.header.label,
      unicode: unicode,
      advanceWidth: advanceWidth,
      path: glyphPath,
    });

    const built: BuiltGlyph = { glyph };

    // Resolve ligature component codepoints for GSUB registration.
    if (isLigature && pg.header.components) {
      const componentCps = resolveComponentCodepoints(
        pg.header.components,
        labelToCodepoint,
      );
      if (componentCps) {
        built.ligatureComponents = componentCps;
      }
    }

    results.push(built);
  }

  return results;
}

// ── Register ligatures ──────────────────────────────────────────────────────

/**
 * Register GSUB ligature substitutions for the given font.
 *
 * opentype.js v1.3.4 approach:
 *   font.substitution.add('liga', { sub: [cpA, cpB], by: ligGlyphIndex })
 */
function registerLigatures(
  font: opentype.Font,
  builtGlyphs: BuiltGlyph[],
): void {
  const ligatures: { sub: number[]; by: number }[] = [];

  for (let i = 0; i < builtGlyphs.length; i++) {
    const bg = builtGlyphs[i];
    if (!bg.ligatureComponents) continue;

    // The glyph index in the font is i + 1 because index 0 is .notdef.
    const glyphIndex = i + 1;

    // Convert codepoints to glyph indices via the font's cmap.
    const subIndices: number[] = [];
    let valid = true;
    for (const cp of bg.ligatureComponents) {
      const idx = font.charToGlyphIndex(String.fromCodePoint(cp));
      if (idx === 0) {
        console.warn(
          `  Warning: component codepoint U+${cp.toString(16).toUpperCase().padStart(4, "0")} not found in font cmap; skipping ligature "${bg.glyph.name}".`,
        );
        valid = false;
        break;
      }
      subIndices.push(idx);
    }
    if (!valid) continue;

    ligatures.push({ sub: subIndices, by: glyphIndex });
  }

  // Sort ligatures: longer ones first (more components = higher priority).
  ligatures.sort((a, b) => b.sub.length - a.sub.length);

  for (const lig of ligatures) {
    font.substitution.add("liga", lig);
  }
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

  // 3. Build a label-to-codepoint map for ligature resolution.
  const labelToCodepoint = new Map<string, number>();
  for (const g of allGlyphs) {
    if (g.header.codepoint !== undefined) {
      labelToCodepoint.set(g.header.label, g.header.codepoint);
    }
  }

  // 4. Build glyphs.
  console.log(`  Building font...`);

  const builtGlyphs = buildGlyphs(
    allGlyphs,
    config,
    labelToCodepoint,
  );

  // 5. Create .notdef glyph (empty, index 0).
  const notdefGlyph = new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: stdAdvanceWidth,
    path: new opentype.Path(),
  });

  // Assemble the glyph array: .notdef must be first.
  const glyphArray = [notdefGlyph, ...builtGlyphs.map((bg) => bg.glyph)];

  // 6. Build the opentype.Font.
  const font = new opentype.Font({
    familyName: config.font.familyName,
    styleName: "Regular",
    unitsPerEm: unitsPerEm,
    ascender: ascender,
    descender: descender,
    glyphs: glyphArray,
  });

  // 7. Register ligature substitutions.
  registerLigatures(font, builtGlyphs);

  const ligCount = builtGlyphs.filter((bg) => bg.ligatureComponents).length;
  console.log(
    `    ${glyphArray.length} glyphs (including .notdef), ${ligCount} ligature(s).`,
  );

  // 8. Export TTF.
  await fs.mkdir(BUILD_DIR, { recursive: true });
  await fs.mkdir(SITE_FONTS_DIR, { recursive: true });

  const ttfPath = path.join(BUILD_DIR, "Sergamon.ttf");
  const woff2BuildPath = path.join(BUILD_DIR, "Sergamon.woff2");
  const woff2SitePath = path.join(SITE_FONTS_DIR, "Sergamon.woff2");

  const arrayBuffer = font.toArrayBuffer();
  const ttfBuffer = Buffer.from(arrayBuffer);
  await fs.writeFile(ttfPath, ttfBuffer);
  console.log(`    Wrote ${ttfPath}`);

  // 9. Convert to WOFF2.
  const woff2Buffer = await wawoff2.compress(ttfBuffer);
  await fs.writeFile(woff2BuildPath, woff2Buffer);
  console.log(`    Wrote ${woff2BuildPath}`);

  // 10. Copy WOFF2 to site/fonts/.
  await fs.writeFile(woff2SitePath, woff2Buffer);
  console.log(`    Wrote ${woff2SitePath}`);

  console.log("\nBuild complete.");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
