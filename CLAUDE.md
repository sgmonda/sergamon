# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sergamon is a pixel-art monospaced programming font. Glyphs are defined as plain-text `.glyph` files (8x16 pixel grids) that compile into TTF and WOFF2 via a TypeScript pipeline using opentype.js v1.3.4 and wawoff2.

## Commands

```bash
npm run validate          # Validate all glyph files
npm run build             # Validate + build TTF/WOFF2 (Regular & Bold)
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
- `src/validate-glyphs.ts` — CLI validator: grid dimensions, characters, duplicates, ASCII completeness, ligature components
- `src/optimize-paths.ts` — Greedy row-merge: adjacent pixels → rectangles (reduces path count)
- `src/glyph-to-path.ts` — Rectangles → opentype.js Path (coordinate conversion)
- `src/auto-bold.ts` — Auto-generates bold by expanding each pixel 1px right
- `src/build-font.ts` — Main orchestrator: parse → optimize → build Font → register ligatures → export TTF → compress WOFF2
- `src/generate-previews.cjs` — PNG preview generator (must be .cjs, see gotchas)
- `src/opentype.d.ts` — Custom type declarations for opentype.js and wawoff2

## Glyph File Format

**Naming:** `U+{CODEPOINT}_{LABEL}.glyph` or `LIG_{component_names}.glyph`

```
# A (U+0041)
# weight: regular
# components: equal greater   ← ligatures only

..XXXX..
.XX..XX.
[... 16 rows total, 8 cols for normal, 8*N cols for N-component ligatures]
```

Grid uses `.` (empty) and `X` (filled) only. Weight is `regular` or `bold`. Missing bold variants are auto-generated.

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
- `font.substitution.add('liga', lig)` — call once per ligature with `{ sub: [glyphIdx...], by: ligGlyphIndex }`, not an array wrapper
- Sort ligatures longest-first before registering
- Glyph array must start with `.notdef` at index 0
- Don't use `@types/opentype.js` (conflicts); use the custom `src/opentype.d.ts`

**@napi-rs/canvas + ESM = OOM:**
- Importing @napi-rs/canvas in ESM causes heap exhaustion regardless of `--max-old-space-size`
- The preview script must be a `.cjs` file run with `node` (not tsx)

**Tokenizer pattern:**
- If `RE_WORD_START` includes chars not in `RE_WORD` (e.g., `@`), the tokenizer infinite-loops. Keep both regex sets consistent.

## Glyph Inventory

- 95 ASCII (U+0020–U+007E) in `glyphs/ascii/`
- 12 Latin Extended (accented vowels, ñ, ü, ç, ß, ø, å, æ) in `glyphs/latin-ext/`
- 19 ligatures (==, !=, <=, >=, =>, ->, <-, >>, <<, ||, &&, //, /*, */, ..., ===, !==, <=>, |>) in `glyphs/ligatures/`

## Adding a Glyph

1. Create the `.glyph` file in the appropriate directory following naming conventions
2. For ligatures: add `# components: name1 name2` header (names must match existing glyph labels)
3. Ligature grid width = 8 * number of components
4. Run `npm run validate` then `npm run dev` to preview
5. Confusable characters (0/O/o, 1/l/I, quotes) must be visually distinct
