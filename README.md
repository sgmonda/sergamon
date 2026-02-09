# Sergamon

**Monospaced font for nostalgic programmers**

![Sergamon Preview](build/previews/preview-python.png)

[![License: OFL-1.1](https://img.shields.io/badge/License-OFL--1.1-blue.svg)](https://opensource.org/licenses/OFL-1.1)
[![Build](https://github.com/sgmonda/sergamon/actions/workflows/build.yml/badge.svg)](https://github.com/sgmonda/sergamon/actions/workflows/build.yml)

---

## Features

- **Monospaced** -- every glyph occupies the same fixed width, keeping code perfectly aligned.
- **Pixel-art aesthetic** -- an 8x16 pixel grid gives each character a crisp, retro look that stays sharp at its design size.
- **19 programming ligatures** -- common operators like `==`, `!=`, `=>`, `->`, `<=`, `>=`, `>>`, `<<`, `||`, `&&`, `//`, `/*`, `*/`, `...`, `===`, `!==`, `<=>`, `|>`, and `<-` render as unified symbols.
- **Designed for code** -- careful distinction between easily confused characters (`0/O/o`, `1/l/I`, `` ` ``/`'`/`"`), plus full ASCII coverage and essential Latin Extended glyphs.
- **Regular and Bold weights** -- both weights included; bold variants are auto-generated when not explicitly designed.

---

## Quick Install

Download the latest `.ttf` or `.woff2` files from the [GitHub Releases](https://github.com/sgmonda/sergamon/releases) page.

### macOS

1. Download `Sergamon-Regular.ttf` and `Sergamon-Bold.ttf` from Releases.
2. Double-click each file and click **Install Font** in the Font Book preview.

### Windows

1. Download the `.ttf` files from Releases.
2. Right-click each file and select **Install** (or **Install for all users**).

### Linux

1. Download the `.ttf` files from Releases.
2. Copy them to `~/.local/share/fonts/` (per-user) or `/usr/local/share/fonts/` (system-wide).
3. Run `fc-cache -fv` to refresh the font cache.

### VS Code

After installing the font on your system, add this to your `settings.json`:

```json
{
  "editor.fontFamily": "'Sergamon', monospace",
  "editor.fontLigatures": true
}
```

---

## How It Works

Sergamon treats glyph definitions as source code. Each character is defined in a plain-text `.glyph` file containing an 8x16 pixel grid. A TypeScript build pipeline parses these files, converts pixel grids into vector outlines, and compiles them into distributable font files (TTF, WOFF2).

Here is the glyph file for the digit zero (`U+0030`):

```
# zero (U+0030)
# weight: regular

........
........
........
..XXXX..
.XX..XX.
.XX.XXX.
.XX.XXX.
.XXXX.X.
.XXX.XX.
.XX..XX.
.XX..XX.
..XXXX..
........
........
........
........
```

Each `.` is an empty pixel and each `X` is a filled pixel. The grid is always 8 columns wide and 16 rows tall. Header comments specify the character name, Unicode codepoint, and weight. Ligature glyphs span multiples of 8 columns (e.g., 16 columns for a two-character ligature like `==`).

The build pipeline:
1. **Validates** all `.glyph` files for correctness (grid dimensions, valid characters, completeness).
2. **Converts** pixel grids into vector outlines using opentype.js, merging adjacent pixels into larger rectangles to minimize path count.
3. **Exports** TTF and WOFF2 font files with proper monospace metrics and OpenType ligature tables.

---

## npm Scripts

| Script | Command | Description |
|---|---|---|
| `validate` | `npm run validate` | Lint all `.glyph` files for format errors |
| `build` | `npm run build` | Validate and compile glyphs into TTF/WOFF2 |
| `previews` | `npm run previews` | Build fonts then generate PNG preview images |
| `site` | `npm run site` | Build fonts and copy WOFF2 to the GitHub Pages site |
| `dev` | `npm run dev` | Launch live preview server for glyph design |
| `clean` | `npm run clean` | Remove the `build/` directory |
| `all` | `npm run all` | Build fonts and generate previews |

---

## Contributing

Contributions are welcome! Whether you want to refine an existing glyph, add a new character, or fix a ligature, see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on the `.glyph` file format, naming conventions, testing workflow, and pull request process.

---

## License

The font files and glyph sources are released under the [SIL Open Font License 1.1](LICENSE).
The build scripts and site code are released under the MIT License.
