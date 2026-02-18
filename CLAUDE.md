# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sergamon is a pixel-art monospaced programming font. Glyphs are defined as plain-text `.glyph` files (8x16 pixel grids) that compile into TTF and WOFF2 via a TypeScript pipeline using opentype.js v1.3.4 and wawoff2.

### Design Principle: What You See Is What You Get

Sergamon deliberately does **not** support ligatures. Each character is rendered exactly as typed -- no automatic substitutions, no hidden transformations. When you type `==`, you see two equal signs. When you type `->`, you see a hyphen and a greater-than sign. This transparency is a core design principle: the font faithfully represents the source code without surprises.

### Design Principle: Single Weight

Inspired by classic hardware terminals, Sergamon has a single weight -- there is no bold, light, or any other variant. Every character renders with the same stroke regardless of the `font-weight` CSS property. This keeps the retro terminal aesthetic consistent and avoids visual noise from weight variations.

## Commands

```bash
npm run validate          # Validate all glyph files
npm run build             # Validate + build TTF/WOFF2
npm run previews          # Build + generate PNG preview images
npm run all               # Build + previews
npm run dev               # Dev server with file watching (localhost:3000)
npm run clean             # Remove build/
npm run site              # Build + copy WOFF2 to site/fonts/
```

## Architecture

**Build pipeline** (sequential, each step depends on previous):

```
.glyph files → parse-glyph.ts → validate-glyphs.ts → optimize-paths.ts → glyph-to-path.ts → build-font.ts → TTF/WOFF2
                                                        (row-merge)        (font coords)      (opentype.js)
```

- `src/types.ts` — Shared interfaces (`ParsedGlyph`, `Rectangle`, `FontConfig`)
- `src/parse-glyph.ts` — Reads `.glyph` files into `ParsedGlyph` (header + boolean[][] grid)
- `src/validate-glyphs.ts` — CLI validator: grid dimensions, characters, duplicates, ASCII completeness
- `src/optimize-paths.ts` — Greedy row-merge: adjacent pixels → rectangles (reduces path count)
- `src/glyph-to-path.ts` — Rectangles → opentype.js Path (coordinate conversion)
- `src/build-font.ts` — Main orchestrator: parse → optimize → build Font → export TTF → compress WOFF2
- `src/generate-previews.cjs` — PNG preview generator (must be .cjs, see gotchas)
- `src/opentype.d.ts` — Custom type declarations for opentype.js and wawoff2

## Glyph File Format

**Naming:** `U+{CODEPOINT}_{LABEL}.glyph`

```
# A (U+0041)

..XXXX..
.XX..XX.
[... 16 rows total, 8 cols]
```

Grid uses `.` (empty) and `X` (filled) only.

## Font Metrics & Coordinate System

- Grid: 8 wide x 16 tall, baseline at row 13
- pixelSize=120, unitsPerEm=1920, ascender=1560, descender=-360, advanceWidth=960
- Pixel grid: row 0 = top, row increases downward
- Font coords: y=0 = baseline, y increases upward
- Conversion: `fontY = (13 - row) * 120`, `fontX = col * 120`
- Rows 0-12 = ascender, rows 13-15 = descender

## Critical Gotchas

**opentype.js v1.3.4 (not v2.x — v2 doesn't exist):**
- `charToGlyphIndex()` takes a **string** (`String.fromCodePoint(cp)`), not a number
- Glyph array must start with `.notdef` at index 0
- Don't use `@types/opentype.js` (conflicts); use the custom `src/opentype.d.ts`

**@napi-rs/canvas + ESM = OOM:**
- Importing @napi-rs/canvas in ESM causes heap exhaustion regardless of `--max-old-space-size`
- The preview script must be a `.cjs` file run with `node` (not tsx)

## Glyph Inventory

- 95 ASCII (U+0020–U+007E) in `glyphs/ascii/`
- 12 Latin Extended (accented vowels, ñ, ü, ç, ß, ø, å, æ) in `glyphs/latin-ext/`

## Adding a Glyph

1. Create the `.glyph` file in the appropriate directory following naming conventions
2. Run `npm run validate` then `npm run build` to compile the font
3. For non-ASCII glyphs, add the codepoint to the `populateLatinExt()` array in `site/index.html` (format: `[0x00XX, "label"]`)
4. Run `npm run dev` to preview
5. Confusable characters (0/O/o, 1/l/I, quotes) must be visually distinct
