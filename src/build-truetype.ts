/**
 * Convert the CFF/OpenType buffer that opentype.js v1.3.4 produces into a real
 * TrueType buffer (sfnt magic 0x00010000, outlines in `glyf`/`loca`).
 *
 * opentype.js can only emit OpenType-CFF, but Apple Books and a few other PDF
 * rasterizers mishandle subsetted CFF fonts (issue #4). Sergamon glyphs are
 * pure axis-aligned rectangles, so we sidestep cu2qu / curve conversion: we
 * build `glyf` from the same Rectangle[] data that fed CFF.
 *
 * We reuse the OTF as a template for tables that are format-agnostic
 * (cmap, name, OS/2, hhea, hmtx) and replace what's CFF-specific:
 *   - drop  CFF
 *   - add   glyf, loca
 *   - patch head  (indexToLocFormat = 1)
 *   - rebuild  maxp (v1.0 with TrueType-specific fields)
 *   - rebuild  post (v2.0 with explicit glyph names)
 */

import type { Rectangle } from "./types.js";
import { buildGlyfAndLoca } from "./glyf-table.js";
import { recomputeChecksums } from "./recompute-checksums.js";

export interface TrueTypeBuildInput {
  /** Buffer produced by opentype.js (sfnt magic 'OTTO'). */
  otfBuffer: Buffer;
  /** Rectangles per glyph, indexed in font glyph order (0 = .notdef, empty). */
  rectsPerGlyph: Rectangle[][];
  /** PostScript glyph names, indexed in font glyph order. */
  glyphNames: string[];
  pixelSize: number;
  baselineRow: number;
  /** Italic angle in fixed 16.16 (0 for upright). */
  italicAngle?: number;
  underlinePosition?: number;
  underlineThickness?: number;
}

const TT_SFNT_VERSION = 0x00010000;

/** Apple's 258 standard glyph names for post format 2.0 (subset we touch). */
const STANDARD_GLYPH_NAMES_INDEX: Map<string, number> = new Map([[".notdef", 0]]);

/** Locate a table directory entry by tag; returns {offset, length} or null. */
function findTable(buf: Buffer, tag: string): { offset: number; length: number } | null {
  const numTables = buf.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const dir = 12 + i * 16;
    if (buf.toString("ascii", dir, dir + 4) === tag) {
      return {
        offset: buf.readUInt32BE(dir + 8),
        length: buf.readUInt32BE(dir + 12),
      };
    }
  }
  return null;
}

function copyTable(buf: Buffer, tag: string): Buffer {
  const t = findTable(buf, tag);
  if (!t) throw new Error(`build-truetype: source font is missing table '${tag}'`);
  return Buffer.from(buf.subarray(t.offset, t.offset + t.length));
}

/**
 * Build a fresh head table from the source OTF's head, patched for TrueType:
 *   - indexToLocFormat = 1 (long offsets)
 *   - bounding box overwritten with the glyf-derived extents
 * checkSumAdjustment is left at 0; recomputeChecksums fills it in later.
 */
function buildHeadTable(
  otfBuffer: Buffer,
  bbox: { xMin: number; yMin: number; xMax: number; yMax: number },
): Buffer {
  const head = copyTable(otfBuffer, "head");
  // Layout (post header offsets):
  //   0  version            FIXED
  //   4  fontRevision       FIXED
  //   8  checkSumAdjustment ULONG
  //  12  magicNumber        ULONG
  //  16  flags              USHORT
  //  18  unitsPerEm         USHORT
  //  20  created            LONGDATETIME (8 bytes)
  //  28  modified           LONGDATETIME (8 bytes)
  //  36  xMin               SHORT
  //  38  yMin               SHORT
  //  40  xMax               SHORT
  //  42  yMax               SHORT
  //  44  macStyle           USHORT
  //  46  lowestRecPPEM      USHORT
  //  48  fontDirectionHint  SHORT
  //  50  indexToLocFormat   SHORT
  //  52  glyphDataFormat    SHORT
  head.writeUInt32BE(0, 8);
  head.writeInt16BE(bbox.xMin, 36);
  head.writeInt16BE(bbox.yMin, 38);
  head.writeInt16BE(bbox.xMax, 40);
  head.writeInt16BE(bbox.yMax, 42);
  head.writeInt16BE(1, 50);
  head.writeInt16BE(0, 52);
  return head;
}

/**
 * maxp version 1.0 — required for TrueType fonts.
 * Most maxX fields are zero for a font with no instructions and no
 * composite glyphs.
 */
function buildMaxpTable(
  numGlyphs: number,
  maxPoints: number,
  maxContours: number,
): Buffer {
  const buf = Buffer.alloc(32);
  buf.writeUInt32BE(0x00010000, 0); // version 1.0
  buf.writeUInt16BE(numGlyphs, 4);
  buf.writeUInt16BE(maxPoints, 6);
  buf.writeUInt16BE(maxContours, 8);
  buf.writeUInt16BE(0, 10); // maxCompositePoints
  buf.writeUInt16BE(0, 12); // maxCompositeContours
  buf.writeUInt16BE(1, 14); // maxZones (1 = no twilight zone)
  buf.writeUInt16BE(0, 16); // maxTwilightPoints
  buf.writeUInt16BE(0, 18); // maxStorage
  buf.writeUInt16BE(0, 20); // maxFunctionDefs
  buf.writeUInt16BE(0, 22); // maxInstructionDefs
  buf.writeUInt16BE(0, 24); // maxStackElements
  buf.writeUInt16BE(0, 26); // maxSizeOfInstructions
  buf.writeUInt16BE(0, 28); // maxComponentElements
  buf.writeUInt16BE(0, 30); // maxComponentDepth
  return buf;
}

/**
 * post version 2.0 — explicit per-glyph names. PDF readers that extract text
 * from an embedded TrueType font use these names to recover the underlying
 * codepoints, so emitting them (instead of post 3.0) helps copy/paste from
 * generated PDFs work correctly.
 */
function buildPostTable(
  glyphNames: string[],
  italicAngle: number,
  underlinePosition: number,
  underlineThickness: number,
): Buffer {
  const numGlyphs = glyphNames.length;
  const customNames: string[] = [];
  const indexes: number[] = new Array(numGlyphs);

  for (let i = 0; i < numGlyphs; i++) {
    const name = glyphNames[i];
    const std = STANDARD_GLYPH_NAMES_INDEX.get(name);
    if (std !== undefined) {
      indexes[i] = std;
    } else {
      indexes[i] = 258 + customNames.length;
      customNames.push(name);
    }
  }

  let namesByteLength = 0;
  for (const n of customNames) {
    if (n.length > 63) {
      throw new Error(`post v2.0 glyph name too long (max 63): "${n}"`);
    }
    namesByteLength += 1 + n.length;
  }

  const headerSize = 32;
  const numGlyphsField = 2;
  const indexSize = 2 * numGlyphs;
  const buf = Buffer.alloc(headerSize + numGlyphsField + indexSize + namesByteLength);

  buf.writeUInt32BE(0x00020000, 0);   // version 2.0
  buf.writeInt32BE(italicAngle, 4);   // FIXED 16.16
  buf.writeInt16BE(underlinePosition, 8);
  buf.writeInt16BE(underlineThickness, 10);
  buf.writeUInt32BE(1, 12);           // isFixedPitch
  buf.writeUInt32BE(0, 16);           // minMemType42
  buf.writeUInt32BE(0, 20);           // maxMemType42
  buf.writeUInt32BE(0, 24);           // minMemType1
  buf.writeUInt32BE(0, 28);           // maxMemType1

  let p = headerSize;
  buf.writeUInt16BE(numGlyphs, p); p += 2;
  for (let i = 0; i < numGlyphs; i++) {
    buf.writeUInt16BE(indexes[i], p);
    p += 2;
  }
  for (const n of customNames) {
    buf.writeUInt8(n.length, p++);
    buf.write(n, p, n.length, "ascii");
    p += n.length;
  }

  return buf;
}

/**
 * Compute the binary-search header fields used in the offset table:
 *   searchRange    = (largest power of 2 ≤ numTables) * 16
 *   entrySelector  = log2(largest power of 2 ≤ numTables)
 *   rangeShift     = numTables * 16 − searchRange
 */
function searchParams(numTables: number): {
  searchRange: number;
  entrySelector: number;
  rangeShift: number;
} {
  let entrySelector = 0;
  let pow = 1;
  while (pow * 2 <= numTables) {
    pow *= 2;
    entrySelector++;
  }
  const searchRange = pow * 16;
  const rangeShift = numTables * 16 - searchRange;
  return { searchRange, entrySelector, rangeShift };
}

/** Round up to a 4-byte boundary. */
function pad4(n: number): number {
  return (n + 3) & ~3;
}

export function buildTrueTypeBuffer(input: TrueTypeBuildInput): Buffer {
  const {
    otfBuffer,
    rectsPerGlyph,
    glyphNames,
    pixelSize,
    baselineRow,
    italicAngle = 0,
    underlinePosition = -120,
    underlineThickness = 120,
  } = input;

  if (rectsPerGlyph.length !== glyphNames.length) {
    throw new Error(
      `build-truetype: rectsPerGlyph (${rectsPerGlyph.length}) and glyphNames (${glyphNames.length}) must align`,
    );
  }

  // ── Build replacement / new tables ────────────────────────────────────
  const { glyf, loca, maxPoints, maxContours, xMin, yMin, xMax, yMax } =
    buildGlyfAndLoca({ rectsPerGlyph, pixelSize, baselineRow });

  const head = buildHeadTable(otfBuffer, { xMin, yMin, xMax, yMax });
  const maxp = buildMaxpTable(rectsPerGlyph.length, maxPoints, maxContours);
  const post = buildPostTable(
    glyphNames,
    italicAngle,
    underlinePosition,
    underlineThickness,
  );

  const os2 = copyTable(otfBuffer, "OS/2");
  const cmap = copyTable(otfBuffer, "cmap");
  const hhea = copyTable(otfBuffer, "hhea");
  const hmtx = copyTable(otfBuffer, "hmtx");
  const name = copyTable(otfBuffer, "name");

  // ── Assemble directory in alphabetical (case-sensitive) order ─────────
  const tables: { tag: string; data: Buffer }[] = [
    { tag: "OS/2", data: os2 },
    { tag: "cmap", data: cmap },
    { tag: "glyf", data: glyf },
    { tag: "head", data: head },
    { tag: "hhea", data: hhea },
    { tag: "hmtx", data: hmtx },
    { tag: "loca", data: loca },
    { tag: "maxp", data: maxp },
    { tag: "name", data: name },
    { tag: "post", data: post },
  ];

  const numTables = tables.length;
  const headerSize = 12;
  const directorySize = 16 * numTables;

  // Compute table offsets (each starts at a 4-byte aligned position).
  const offsets: number[] = [];
  let cursor = headerSize + directorySize;
  for (const t of tables) {
    offsets.push(cursor);
    cursor += pad4(t.data.length);
  }
  const totalSize = cursor;

  const out = Buffer.alloc(totalSize);

  // Offset table (header).
  const { searchRange, entrySelector, rangeShift } = searchParams(numTables);
  out.writeUInt32BE(TT_SFNT_VERSION, 0);
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(searchRange, 6);
  out.writeUInt16BE(entrySelector, 8);
  out.writeUInt16BE(rangeShift, 10);

  // Table directory (checksums populated later by recomputeChecksums).
  for (let i = 0; i < numTables; i++) {
    const dir = headerSize + i * 16;
    out.write(tables[i].tag, dir, 4, "ascii");
    out.writeUInt32BE(0, dir + 4);            // checksum (placeholder)
    out.writeUInt32BE(offsets[i], dir + 8);   // offset
    out.writeUInt32BE(tables[i].data.length, dir + 12); // length
  }

  // Table data, padded to 4 bytes between tables.
  for (let i = 0; i < numTables; i++) {
    tables[i].data.copy(out, offsets[i]);
  }

  recomputeChecksums(out);
  return out;
}
