# Contributing to Sergamon

Thank you for your interest in contributing to Sergamon! This guide covers everything you need to know to add or modify glyphs, test your changes, and submit a pull request.

---

## Prerequisites

- Node.js >= 20
- npm (comes with Node.js)

Clone the repository and install dependencies:

```bash
git clone https://github.com/sgmonda/sergamon.git
cd sergamon
npm ci
```

---

## Design Principle: What You See Is What You Get

Sergamon does **not** support ligatures. Each character is rendered exactly as typed -- no automatic substitutions, no hidden transformations. This is a deliberate design choice: your source code should look exactly as you wrote it.

## Design Principle: Single Weight

Sergamon has one weight only -- no bold, no light. Inspired by classic hardware terminals, every character renders with the same uniform stroke. Do not add weight variants.

---

## How to Add a Glyph

### Create the `.glyph` file

Each glyph is defined in a plain-text file with a 10x18 pixel grid (8x18 character with 1-column margin on each side). Use `.` for empty pixels and `X` for filled pixels.

**Example -- the letter A (`U+0041`):**

```
# A (U+0041)

..........
..........
..........
..........
..........
...XXX....
..XX.XX...
.XX...XX..
.XX...XX..
.XX...XX..
.XXXXXXX..
.XX...XX..
.XX...XX..
.XX...XX..
.XX...XX..
..........
..........
..........
```

Header lines start with `#` and must include:
- **Line 1**: a human-readable label and Unicode codepoint.

The grid must be exactly **10 columns wide** and **18 rows tall**. Only `.` and `X` characters are allowed in grid rows. Every row must have exactly 10 characters. Files must end with a newline and contain no trailing whitespace.

---

## File Naming Conventions

- **Format**: `U+{CODEPOINT}_{LABEL}.glyph`
  - Examples: `U+0041_A.glyph`, `U+00F1_ntilde.glyph`

Place files in the appropriate subdirectory:

| Category | Directory |
|---|---|
| ASCII (U+0020 -- U+007E) | `glyphs/ascii/` |
| Latin Extended (accents, etc.) | `glyphs/latin-ext/` |

---

## How to Test

### Validate glyph files

Run the validator to check all `.glyph` files for format errors:

```bash
npm run validate
```

This checks grid dimensions, valid characters, duplicate codepoints, and completeness of the ASCII range. It exits with a non-zero code and clear error messages on any failure.

### Live preview

For interactive glyph design, use the development preview server:

```bash
npm run dev
```

This watches `.glyph` files for changes, rebuilds the font, and opens a live preview in your browser with auto-reload.

### Full build

To run the complete build pipeline (validate, build fonts, generate previews):

```bash
npm run all
```

---

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`.
2. **Add or modify** glyph files following the format and naming conventions above.
3. **Run `npm run validate`** to ensure there are no errors.
4. **Run `npm run dev`** to visually inspect your changes.
5. **Commit** with a clear message describing what was added or changed (e.g., "Add glyph for U+00E9 eacute" or "Fix alignment of digit 8").
6. **Open a pull request** against `main`.

Both single-glyph PRs and batch additions are welcome. If you are adding a batch, please group related glyphs (e.g., all Latin Extended vowels) in a single PR for easier review.

The CI pipeline will automatically validate your glyph files on every pull request.

---

## Style Guidelines

To maintain visual consistency across the font, follow these pixel-art conventions:

### Stroke width
- Use **1-pixel or 2-pixels strokes** only.
- Vertical strokes are 2-pixels width.
- Horizontal strokes are 1-pixel width.

### Character proportions
- Most uppercase letters should span columns 2--8 (0-indexed), leaving columns 0--1 and column 9 as side-bearings when possible.
- Lowercase letters typically occupy the middle rows (approximately rows 5--14), with ascenders reaching row 3--4 and descenders extending to rows 15--17.
- Digits should be the same height as uppercase letters.

### Curvature
- Round shapes (O, C, 0, etc.) should use corner cuts: replace the four corner pixels with empty pixels to approximate a curve within the pixel grid.
- Ensure round characters visually match in size and proportion.

### Distinguishability
- Zero (`0`) must include a diagonal slash or dot to distinguish it from uppercase O.
- Lowercase L (`l`) must have a distinct foot or serif to distinguish it from digit one (`1`) and uppercase I.
- Backtick, single quote, and double quote must each be visually distinct.

### Spacing and alignment
- All glyphs must respect the fixed 10-column width. Do not use columns outside the grid.
- Baseline is at row 15 (0-indexed). Characters should sit on the baseline unless they have descenders.
- Maintain consistent vertical alignment for similar character classes (all digits at the same height, all uppercase at the same height, etc.).

### General principles
- Fewer filled pixels is often better -- keep designs clean and readable.
- Test at the intended display size (16px) to verify legibility.
- When in doubt, study how the existing glyphs handle similar shapes and match their style.
