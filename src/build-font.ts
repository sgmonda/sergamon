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
import { recomputeChecksums } from "./recompute-checksums.js";
import { buildTrueTypeBuffer } from "./build-truetype.js";

// ── Constants ───────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);

const PKG_PATH = path.join(PROJECT_ROOT, "package.json");
const CONFIG_PATH = path.join(PROJECT_ROOT, "font-config.json");

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

const BUILD_DIR = path.join(PROJECT_ROOT, "build");
const SITE_FONTS_DIR = path.join(PROJECT_ROOT, "site", "fonts");

// ── Build font ─────────────────────────────────────────────────────────────

/**
 * Derive a unique PostScript glyph name from a codepoint.
 *
 * Using the human-readable label from the .glyph header collides across
 * scripts (e.g. latin/cyrillic share `A`, `I`, `O`...), and opentype.js
 * silently disambiguates with `.1`/`.2` suffixes. Some PDF rasterizers
 * reverse-map glyph names back to codepoints, so `Eacute.1` ends up rendered
 * as É instead of Í. Using `uniXXXX`/`uXXXXX` per Adobe Glyph List spec
 * guarantees uniqueness and avoids that misinterpretation. See issue #3.
 */
function postScriptName(codepoint: number | undefined, fallback: string): string {
  if (codepoint === undefined) return fallback;
  if (codepoint <= 0xffff) return `uni${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
  return `u${codepoint.toString(16).toUpperCase().padStart(5, "0")}`;
}

interface BuiltGlyph {
  glyph: opentype.Glyph;
  rects: Rectangle[];
  name: string;
}

function buildGlyphs(
  parsedGlyphs: ParsedGlyph[],
  config: FontConfig,
): BuiltGlyph[] {
  const { pixelSize } = config.metrics;
  const { baselineRow, width: stdWidth } = config.grid;
  const stdAdvanceWidth = pixelSize * stdWidth;

  const results: BuiltGlyph[] = [];

  for (const pg of parsedGlyphs) {
    const rects: Rectangle[] = optimizeGrid(pg.grid);
    const glyphPath = glyphToPath(rects, pixelSize, baselineRow);
    const name = postScriptName(pg.header.codepoint, pg.header.label);

    const glyph = new opentype.Glyph({
      name,
      unicode: pg.header.codepoint,
      advanceWidth: stdAdvanceWidth,
      path: glyphPath,
    });

    results.push({ glyph, rects, name });
  }

  return results;
}

// ── Binary patches ──────────────────────────────────────────────────────────

/**
 * Locate a table in the TTF table directory by its 4-char tag.
 * TTF table directory starts at offset 12; each record is 16 bytes:
 *   tag(4) + checksum(4) + offset(4) + length(4).
 * Returns the table offset, or -1 if not found.
 */
function findTableOffset(buf: Buffer, tableTag: string): number {
  const numTables = buf.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = buf.toString("ascii", rec, rec + 4);
    if (tag === tableTag) {
      return buf.readUInt32BE(rec + 8);
    }
  }
  return -1;
}

/**
 * Set post.isFixedPitch = 1.
 * opentype.js hardcodes isFixedPitch=0; we patch at byte offset 12
 * within the post table (after version, italicAngle, underline fields).
 */
function patchPostIsFixedPitch(buf: Buffer): void {
  const off = findTableOffset(buf, "post");
  if (off !== -1) buf.writeUInt32BE(1, off + 12);
}

/**
 * Set head.fontRevision to match the package version.
 * fontRevision is a Fixed (16.16) at byte offset 4 within the head table.
 * opentype.js defaults it to 1.0; we patch it to the actual version
 * so macOS Font Book detects version changes correctly.
 */
function patchHeadFontRevision(buf: Buffer, version: string): void {
  const off = findTableOffset(buf, "head");
  if (off === -1) return;
  const num = parseFloat(version); // "1.11.0" → 1.11
  const fixed = Math.round(num * 65536); // 16.16 fixed-point
  buf.writeUInt32BE(fixed, off + 4);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Building Sergamon font...\n");

  // 1. Read configuration.
  const [configRaw, pkgRaw] = await Promise.all([
    fs.readFile(CONFIG_PATH, "utf-8"),
    fs.readFile(PKG_PATH, "utf-8"),
  ]);
  const config: FontConfig = JSON.parse(configRaw);
  const pkg = JSON.parse(pkgRaw);
  const version: string = pkg.version;

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
  const glyphArray: opentype.Glyph[] = [notdefGlyph, ...builtGlyphs.map((b) => b.glyph)];
  const rectsPerGlyph: Rectangle[][] = [[], ...builtGlyphs.map((b) => b.rects)];
  const glyphNames: string[] = [".notdef", ...builtGlyphs.map((b) => b.name)];

  // 5. Build the opentype.Font.
  const familyName = config.font.familyName;
  const styleName = "Regular";

  const font = new opentype.Font({
    familyName,
    styleName,
    unitsPerEm: unitsPerEm,
    ascender: ascender,
    descender: descender,
    glyphs: glyphArray,
  });

  // ── Name table (IDs 0–14, 16–17, 19) ──────────────────────────────────
  const authorName: string = typeof pkg.author === "string" ? pkg.author : pkg.author?.name ?? familyName;
  const authorUrl: string = typeof pkg.author === "string" ? "" : pkg.author?.url ?? "";
  const description: string = pkg.description ?? "";
  const licenseSPDX: string = pkg.license ?? "";
  const licenseText = licenseSPDX === "OFL-1.1"
    ? "This Font Software is licensed under the SIL Open Font License, Version 1.1."
    : licenseSPDX;
  const year = new Date().getFullYear();

  const n = font.names;
  n.copyright       = { en: `Copyright (c) ${year}, ${authorName} (${authorUrl})` };
  // fontFamily (ID 1) and fontSubfamily (ID 2) are set by the constructor
  n.uniqueID        = { en: `${version};${config.font.vendorID};${familyName}-${styleName}` };
  n.fullName        = { en: `${familyName} ${styleName}` };
  n.version         = { en: `Version ${version}` };
  n.postScriptName  = { en: `${familyName}-${styleName}` };
  n.manufacturer    = { en: authorName };
  n.designer        = { en: authorName };
  n.description     = { en: description };
  n.manufacturerURL = { en: authorUrl };
  n.designerURL     = { en: authorUrl };
  n.license         = { en: licenseText };
  n.licenseURL      = { en: config.font.licenseURL };
  n.preferredFamily = { en: familyName };
  n.preferredSubfamily = { en: styleName };
  n.sampleText      = { en: config.font.sampleText };

  // ── OS/2 table ─────────────────────────────────────────────────────────
  // opentype.js merges font.tables.os2 into the OS/2 make() options via
  // Object.assign. Panose bytes are individual fields, not an array.
  const os2 = (font as any).tables.os2;
  if (os2) {
    os2.achVendID       = config.font.vendorID;        // 4-char vendor ID
    os2.usWeightClass   = 400;                         // Regular
    os2.usWidthClass    = 5;                           // Medium (normal)
    os2.fsType          = 0x0000;                      // Installable embedding
    // PANOSE classification: Latin Text / No Fit / Regular / Monospaced
    os2.bFamilyType     = 2;                           // Latin Text
    os2.bSerifStyle     = 1;                           // No Fit
    os2.bWeight         = 5;                           // Book (Regular)
    os2.bProportion     = 9;                           // Monospaced
    os2.bContrast       = 0;                           // Any
    os2.bStrokeVariation = 0;                          // Any
    os2.bArmStyle       = 0;                           // Any
    os2.bLetterform     = 0;                           // Any
    os2.bMidline        = 0;                           // Any
    os2.bXHeight        = 0;                           // Any
  }

  console.log(`    Version: ${version}`);
  console.log(`    ${glyphArray.length} glyphs (including .notdef).`);

  // 6. Export TTF.
  await fs.mkdir(BUILD_DIR, { recursive: true });
  await fs.mkdir(SITE_FONTS_DIR, { recursive: true });

  const otfPath = path.join(BUILD_DIR, "Sergamon.otf");
  const woff2BuildPath = path.join(BUILD_DIR, "Sergamon.woff2");
  const woff2SitePath = path.join(SITE_FONTS_DIR, "Sergamon.woff2");

  const arrayBuffer = font.toArrayBuffer();
  const otfBuffer = Buffer.from(arrayBuffer);

  // opentype.js v1.3.4 emits OpenType-CFF (sfnt magic 'OTTO') and hardcodes
  // post.isFixedPitch=0 / head.fontRevision=1.0. Patch the binary, then
  // recompute table checksums so Windows accepts the file (issue #2).
  patchPostIsFixedPitch(otfBuffer);
  patchHeadFontRevision(otfBuffer, version);
  recomputeChecksums(otfBuffer);

  await fs.writeFile(otfPath, otfBuffer);
  console.log(`    Wrote ${otfPath}`);

  // 7. Build TrueType (sfnt 0x00010000, outlines in glyf/loca) from the same
  //    rectangle data, reusing the OTF as a template for format-agnostic
  //    tables. Apple Books and similar PDF rasterizers mishandle subsetted
  //    CFF; shipping a real TrueType file fixes that (issue #4).
  const ttfPath = path.join(BUILD_DIR, "Sergamon.ttf");
  const ttfBuffer = buildTrueTypeBuffer({
    otfBuffer,
    rectsPerGlyph,
    glyphNames,
    pixelSize,
    baselineRow,
  });
  await fs.writeFile(ttfPath, ttfBuffer);
  console.log(`    Wrote ${ttfPath}`);

  // 8. WOFF2 is built from the TrueType buffer so the web flavour matches
  //    the primary desktop install.
  const woff2Buffer = await wawoff2.compress(ttfBuffer);
  await fs.writeFile(woff2BuildPath, woff2Buffer);
  console.log(`    Wrote ${woff2BuildPath}`);

  await fs.writeFile(woff2SitePath, woff2Buffer);
  console.log(`    Wrote ${woff2SitePath}`);

  console.log("\nBuild complete.");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
