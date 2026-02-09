# Sergamon — Project Specification

## Overview

Open-source monospaced pixel font (8×16 grid) designed for programming. The project treats glyph definitions as source code: plain-text grid files that a TypeScript build pipeline compiles into distributable font files (TTF, WOFF2) and preview assets. Includes a GitHub Pages site where users can test the font live with syntax-highlighted code.

---

## 1. Project Structure

```
sergamon/
├── glyphs/                    # Glyph source files (the "code")
│   ├── ascii/                 # Basic ASCII (U+0020–U+007E)
│   │   ├── U+0041_A.glyph
│   │   ├── U+0042_B.glyph
│   │   └── ...
│   ├── latin-ext/             # Latin Extended (accents, ñ, ç, etc.)
│   │   └── ...
│   └── ligatures/             # Programming ligatures
│       ├── LIG_equal_equal.glyph      # ==
│       ├── LIG_bang_equal.glyph       # !=
│       ├── LIG_arrow_right.glyph      # =>
│       ├── LIG_arrow_left.glyph       # <=
│       ├── LIG_arrow_fat.glyph        # ->
│       └── ...
├── src/                       # TypeScript build tools
│   ├── build-font.ts          # Glyph files → TTF/WOFF2
│   ├── generate-previews.ts   # Generates PNG previews of sample code
│   ├── validate-glyphs.ts     # Lints glyph files for errors
│   └── dev-preview.ts         # Live preview during glyph design
├── site/                      # GitHub Pages site
│   ├── index.html             # Single-page app (self-contained)
│   └── fonts/                 # WOFF2 copied here by `npm run site`
│       ├── Sergamon-Regular.woff2
│       └── Sergamon-Bold.woff2
├── build/                     # Generated output (gitignored)
│   ├── Sergamon-Regular.ttf
│   ├── Sergamon-Regular.woff2
│   ├── Sergamon-Bold.ttf
│   ├── Sergamon-Bold.woff2
│   └── previews/
│       ├── preview-python.png
│       ├── preview-js.png
│       └── preview-rust.png
├── font-config.json
├── package.json
├── tsconfig.json
├── LICENSE                    # SIL Open Font License 1.1
├── CONTRIBUTING.md
└── README.md
```

---

## 2. Glyph Source Format

### 2.1 File naming

Each file represents one glyph. Naming convention:

- ASCII & Unicode: `U+{CODEPOINT}_{LABEL}.glyph`
  - Example: `U+0041_A.glyph`, `U+00F1_ntilde.glyph`
- Ligatures: `LIG_{component_names}.glyph`
  - Example: `LIG_equal_equal.glyph` for `==`

### 2.2 File format

```
# A (U+0041)
# weight: regular

..XXXX..
.X....X.
X......X
X......X
X......X
X......X
XXXXXXXX
X......X
X......X
X......X
X......X
X......X
X......X
........
........
........
```

Rules:

- **Header comments** start with `#`. Required fields:
  - Line 1: human-readable label and codepoint
  - `weight`: `regular` or `bold`
- **Grid dimensions**: all glyphs are **8 columns × 16 rows**. No width/height headers needed — the build validates this.
- **Grid characters**:
  - `.` = empty pixel
  - `X` = filled pixel
- All rows must have exactly 8 characters.
- No trailing whitespace. Files end with a newline.
- The top row is the top of the em square; the bottom row is the lowest descender pixel.

### 2.3 Bold weight

Bold variants live in the same directory, distinguished by `weight: bold` in the header. Example:

```
# A (U+0041)
# weight: bold

.XXXXXX.
XX....XX
XX....XX
XX....XX
XX....XX
XX....XX
XXXXXXXX
XX....XX
XX....XX
XX....XX
XX....XX
XX....XX
XX....XX
........
........
........
```

If a glyph has no bold variant file, the build script auto-generates one by expanding each filled pixel one unit to the right.

### 2.4 Ligature mapping

Ligature files include an additional header field:

```
# => (ligature)
# weight: regular
# components: equal greater

................
................
..............X.
.............X..
XXXXXXXX...X....
XXXXXXXX..X.....
.............X..
..............X.
................
................
................
................
................
................
................
................
```

`components` lists the glyph names that trigger the ligature, in order. Width of a ligature is `8 * number_of_components`. All 16 rows must be present.

---

## 3. Build Pipeline

### 3.1 `src/validate-glyphs.ts`

Validates all `.glyph` files before building:

- All grids are exactly 8 columns × 16 rows (ligatures: `8*N` columns × 16 rows)
- No invalid characters (only `.`, `X`, `#`, spaces in comments)
- All codepoints are valid Unicode
- No duplicate codepoints
- Required ASCII range (U+0020–U+007E) is complete
- Ligature `components` reference existing glyphs
- `weight` is either `regular` or `bold`

Exits with non-zero code and clear error messages on failure.

### 3.2 `src/build-font.ts`

Converts glyph files into font files. Uses **opentype.js**.

Pipeline:

1. Parse all `.glyph` files into pixel grids
2. For each glyph, convert the pixel grid into vector outlines:
   - Each `X` becomes a square path at `(col * pixel_size, row * pixel_size)` of size `pixel_size`
   - **Merge adjacent filled pixels** into larger rectangles (greedy row-merge algorithm) to reduce path count and file size
   - Coordinate system: y=0 at baseline. Baseline is at row 13 (counting from 0), giving 13 rows ascender + 3 rows descender
3. Build the font using opentype.js:
   - Set font metadata (name, version, license, description)
   - Set monospace metrics (all glyphs same advance width)
   - Add OpenType ligature features (`liga`, `calt`) for programming ligatures
   - Embed hinting for pixel-perfect rendering at the design size
4. Export:
   - `.ttf` (TrueType) — via `opentype.js` `font.download()` / `font.toArrayBuffer()`
   - `.woff2` — via `woff2-encoder` or `wawoff2`
5. Copy WOFF2 files to `site/fonts/` for the GitHub Pages site

### 3.3 `font-config.json`

```json
{
  "font": {
    "familyName": "Sergamon",
    "version": "1.0.0",
    "description": "Monospaced font for nostalgic programmers",
    "designer": "",
    "url": ""
  },
  "grid": {
    "width": 8,
    "height": 16,
    "baselineRow": 13
  },
  "metrics": {
    "pixelSize": 120,
    "ascenderPx": 13,
    "descenderPx": 3,
    "lineGapPx": 1
  },
  "weights": {
    "regular": 400,
    "bold": 700
  }
}
```

`baselineRow: 13` means rows 0–12 are above the baseline (ascender) and rows 13–15 are below (descender).

### 3.4 `src/generate-previews.ts`

Generates PNG preview images for the README and site:

- Renders sample code snippets using the built font
- Uses `@napi-rs/canvas` (Skia bindings) or `sharp` + SVG overlay to render text onto images
- Generates both light and dark theme variants
- Sample languages: Python, JavaScript/TypeScript, Rust, Go
- Output size: 1200×800px, 2x for retina

### 3.5 `src/dev-preview.ts`

Development tool: watches `.glyph` files for changes, rebuilds and opens a local preview in the browser. Not required for CI, just for glyph design convenience. Uses a simple HTTP server (e.g., `chokidar` for file watching + lightweight server) with auto-reload.

---

## 4. npm Scripts (package.json)

```json
{
  "scripts": {
    "validate": "tsx src/validate-glyphs.ts",
    "build": "npm run validate && tsx src/build-font.ts",
    "previews": "npm run build && tsx src/generate-previews.ts",
    "site": "npm run build && cp build/*.woff2 site/fonts/",
    "dev": "tsx src/dev-preview.ts",
    "clean": "rm -rf build/",
    "all": "npm run build && npm run previews"
  }
}
```

Use `tsx` for direct TypeScript execution without a separate compile step.

---

## 5. GitHub Pages Site

### 5.1 Architecture

Single self-contained `site/index.html` file. No build step, no framework, no external dependencies except:

- **Highlight.js** (from CDN) for syntax highlighting
- The font's own WOFF2 files from `./fonts/`

### 5.2 Site Layout and Design

The site is dark-themed by default (with a light/dark toggle) and has a clean, developer-focused aesthetic. The pixel nature of the font should influence the design subtly (e.g., pixel-art decorative elements in the header, grid-aligned layout).

#### Header
- Font name (rendered in the font itself, large)
- One-line description: "Monospaced font for nostalgic programmers"
- Download button (links to latest GitHub release)
- GitHub repo link

#### Section 1: Code Preview (hero section, most prominent)
- Large code editor area showing syntax-highlighted code
- **Language selector** tabs: Python, JavaScript, TypeScript, Rust, Go, HTML/CSS, Java, C
- Each tab shows an idiomatic code snippet (~20–30 lines) that showcases:
  - Variable names, strings, numbers, comments
  - Operators and ligatures (`==`, `!=`, `=>`, `->`, `<=`, `>=`)
  - Bracket/brace/paren nesting
  - Distinguishability of `0/O/o`, `1/l/I`, backtick/quote
- Users can also **type their own code** in the editor area
- **Font size slider** (12px–24px, default 16px)
- **Line height slider** (1.0–2.0, default 1.5)
- **Theme toggle**: light editor / dark editor (separate from site theme)

#### Section 2: Character Grid
- Full grid of all available glyphs organized by category (ASCII, Latin Extended, Ligatures)
- Hovering over a character shows it enlarged with its codepoint

#### Section 3: Distinguishability Test
- Side-by-side comparisons of commonly confused character pairs:
  - `0 O o`, `1 l I |`, `" ' `` `, `{ ( [`, `: ;`, `. ,`
- Rendered at multiple sizes (16px, 24px, 32px)

#### Section 4: Comparison
- Same code snippet rendered in the pixel font vs. popular alternatives (Fira Code, JetBrains Mono, Cascadia Code)
- Uses system/web fonts for comparison; the pixel font loaded from WOFF2

#### Section 5: Installation
- Tabs for: macOS, Windows, Linux, VS Code, IntelliJ, Terminal configs
- Code blocks with copy-to-clipboard buttons
- VS Code settings.json snippet example

#### Footer
- License (SIL OFL)
- Links: GitHub, Issues, Releases

### 5.3 Technical Requirements

- The entire site must be a **single HTML file** with embedded CSS and JS
- Highlight.js loaded from `cdnjs.cloudflare.com`
- Font loaded via `@font-face` pointing to `./fonts/Sergamon-Regular.woff2` and `./fonts/Sergamon-Bold.woff2`
- Must be responsive (mobile-friendly)
- No cookies, no analytics, no tracking
- The code editor area uses a `<textarea>` overlaid with a `<pre><code>` for the highlighting (standard code-editor-in-browser pattern)
- Syntax highlighting re-applies on every keystroke (debounced at 150ms)
- All interactive controls (sliders, toggles, tabs) work without JavaScript where possible (CSS-only), with JS enhancement

### 5.4 GitHub Pages Deployment

The site is served from the `site/` directory. Configure GitHub Pages to serve from the `site/` folder on the `main` branch. The `npm run site` command copies the built WOFF2 files into `site/fonts/`, so the HTML references `./fonts/` and everything is self-contained within `site/`.

---

## 6. README.md

The README must include:

1. **Hero image**: a preview PNG showing code in the font (generated by the build)
2. **Badges**: License (OFL), Build status
3. **One-paragraph description**
4. **Feature highlights**: monospace, pixel-art, ligatures, designed for code
5. **Quick install** instructions (brew, apt, manual download)
6. **Screenshot gallery**: code in different languages, light/dark themes
7. **Distinguishability showcase**: the `0/O/o`, `1/l/I` comparisons as inline images
8. **"How it works"**: brief explanation of the glyph-as-code approach, with an example glyph file
2. **Contributing guide link**: point to `CONTRIBUTING.md`
3. **License**: SIL Open Font License 1.1

---

## 7. CONTRIBUTING.md

Must cover:

1. **How to add a glyph**: create a `.glyph` file following the format spec (8×16 grid), run validation
2. **How to test changes**: `npm run dev` for live preview
3. **Naming conventions** for files
4. **Pull request process**: one glyph per PR is fine, or batch additions
5. **Style guidelines**: pixel art consistency rules (stroke width, curvature, etc. — to be defined by the designer and added here)

---

## 8. CI / GitHub Actions

### Workflow: `.github/workflows/build.yml`

Triggers: push to `main`, pull requests

Steps:

1. Checkout repo
2. Set up Node.js 20, `npm ci`
3. `npm run validate` — fail fast on invalid glyphs
4. `npm run build` — generate font files
5. `npm run previews` — generate preview images
6. On `main` push only: create a GitHub Release with TTF and WOFF2 assets (tagged by version from `font-config.json`)

### Workflow: `.github/workflows/pages.yml`

Deploys `site/` to GitHub Pages on push to `main`.

---

## 9. Initial Glyph Set (MVP)

For the first release, the font must include at minimum:

- **Full ASCII printable range** (U+0020–U+007E): space through tilde (95 glyphs)
- **Core programming ligatures**: `==`, `!=`, `<=`, `>=`, `=>`, `->`, `<-`, `>>`, `<<`, `||`, `&&`, `//`, `/*`, `*/`, `...`, `===`, `!==`, `<=>`, `|>`
- **Essential Latin Extended**: `á`, `é`, `í`, `ó`, `ú`, `ñ`, `ü`, `ç`, `ß`, `ø`, `å`, `æ` (enough for Spanish, French, German, Nordic)

Bold weight for all the above.

---

## 10. Non-Goals (Explicitly Out of Scope)

- Variable font support
- Multiple pixel densities (only one grid resolution)
- CJK or Arabic glyphs
- Font editor GUI
- Google Fonts submission (future milestone, not MVP)

---

## 11. Dependencies

### Node.js (package.json `devDependencies`)

```json
{
  "opentype.js": "^2.0.0",
  "wawoff2": "^2.0.1",
  "@napi-rs/canvas": "^0.1.0",
  "chokidar": "^3.6.0",
  "tsx": "^4.0.0",
  "typescript": "^5.4.0"
}
```

### Runtime requirements

- Node.js >= 20
- No native dependencies beyond what `@napi-rs/canvas` bundles

---

## 12. License

The font files and glyph sources are released under the **SIL Open Font License 1.1**.
The build scripts and site code are released under **MIT License**.
