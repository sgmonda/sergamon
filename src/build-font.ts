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

const PKG_PATH = path.join(PROJECT_ROOT, "package.json");
const CONFIG_PATH = path.join(PROJECT_ROOT, "font-config.json");

const GLYPH_DIRS = [
  path.join(PROJECT_ROOT, "glyphs", "ascii"),
  path.join(PROJECT_ROOT, "glyphs", "latin-ext"),
  path.join(PROJECT_ROOT, "glyphs", "arrows"),
  path.join(PROJECT_ROOT, "glyphs", "box-drawing"),
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
  const glyphArray = [notdefGlyph, ...builtGlyphs];

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

  const ttfPath = path.join(BUILD_DIR, "Sergamon.ttf");
  const woff2BuildPath = path.join(BUILD_DIR, "Sergamon.woff2");
  const woff2SitePath = path.join(SITE_FONTS_DIR, "Sergamon.woff2");

  const arrayBuffer = font.toArrayBuffer();
  const ttfBuffer = Buffer.from(arrayBuffer);

  // Patch binary fields that opentype.js doesn't expose via its API.
  patchPostIsFixedPitch(ttfBuffer);
  patchHeadFontRevision(ttfBuffer, version);

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
