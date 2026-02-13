<div align="center">

<br />

<img width="341" height="85" alt="Sergamon" src="https://github.com/user-attachments/assets/f838ac8d-4ab0-4b8f-8a6e-3c2d8425857a" />

<br />

**A pixel-art monospaced font for nostalgic hackers**

<br />

[![Release](https://img.shields.io/github/v/release/sgmonda/sergamon?style=flat-square&label=release&color=blue)](https://github.com/sgmonda/sergamon/releases)
[![License: OFL-1.1](https://img.shields.io/badge/license-OFL--1.1-green?style=flat-square)](https://opensource.org/licenses/OFL-1.1)
[![Build](https://img.shields.io/github/actions/workflow/status/sgmonda/sergamon/build.yml?style=flat-square&label=build)](https://github.com/sgmonda/sergamon/actions/workflows/build.yml)
[![Glyphs](https://img.shields.io/badge/glyphs-107-orange?style=flat-square)](https://sgmonda.com/sergamon)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen?style=flat-square)](https://nodejs.org)

<br />

[Website](https://sgmonda.com/sergamon) &bull; [Releases](https://github.com/sgmonda/sergamon/releases) &bull; [Contributing](CONTRIBUTING.md)

<br />

</div>

## Table of Contents

- [Features](#features)
- [Quick Install](#quick-install)
- [Editor & Terminal Setup](#editor--terminal-setup)
- [Web Usage](#web-usage)
- [How It Works](#how-it-works)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

| | |
|---|---|
| **Monospaced** | Every glyph occupies the same fixed width, keeping code perfectly aligned. |
| **Pixel-art aesthetic** | An 8x16 pixel grid gives each character a crisp, retro look that stays sharp at its design size. |
| **What you see is what you get** | No ligatures, no automatic substitutions. `==` is two equal signs, `->` is a hyphen and a greater-than. Your source code looks exactly as you typed it. |
| **Single weight** | Inspired by classic hardware terminals -- one weight, uniform strokes, no bold or light variants. |
| **Designed for code** | Careful distinction between confusable characters (`0/O/o`, `1/l/I`, `` ` ``/`'`/`"`), full ASCII coverage, and essential Latin Extended glyphs. |

## Quick Install

Download the latest `Sergamon.ttf` or `Sergamon.woff2` from the [Releases](https://github.com/sgmonda/sergamon/releases) page, then follow the instructions for your OS:

<details>
<summary><strong>macOS</strong></summary>

1. Download `Sergamon.ttf`.
2. Double-click the file and click **Install Font** in Font Book.

</details>

<details>
<summary><strong>Windows</strong></summary>

1. Download `Sergamon.ttf`.
2. Right-click the file and select **Install** (or **Install for all users**).

</details>

<details>
<summary><strong>Linux</strong></summary>

```bash
# Per-user install
cp Sergamon.ttf ~/.local/share/fonts/
fc-cache -fv

# Or system-wide
sudo cp Sergamon.ttf /usr/local/share/fonts/
sudo fc-cache -fv
```

</details>

## Editor & Terminal Setup

After installing the font on your system, configure your editor or terminal to use it.

<details open>
<summary><strong>VS Code</strong></summary>

Add to your `settings.json`:

```json
{
  "editor.fontFamily": "'Sergamon', monospace",
  "editor.fontSize": 16
}
```

</details>

<details>
<summary><strong>JetBrains IDEs</strong> (IntelliJ, WebStorm, PyCharm, etc.)</summary>

Go to **Settings > Editor > Font** and set:
- **Font**: Sergamon
- **Size**: 16

</details>

<details>
<summary><strong>Sublime Text</strong></summary>

Add to your user preferences (`Preferences > Settings`):

```json
{
  "font_face": "Sergamon",
  "font_size": 16
}
```

</details>

<details>
<summary><strong>Vim / Neovim (GUI)</strong></summary>

Add to your config:

```vim
set guifont=Sergamon:h16
```

For Neovide or other GUI frontends, consult their documentation for font configuration.

</details>

<details>
<summary><strong>iTerm2</strong></summary>

Go to **Preferences > Profiles > Text** and set:
- **Font**: Sergamon
- **Size**: 16
- Check **Use a different font for non-ASCII text** if mixing with another font.

</details>

<details>
<summary><strong>Windows Terminal</strong></summary>

Open Settings (`Ctrl+,`), select your profile, and under **Appearance**:
- **Font face**: Sergamon
- **Font size**: 16

Or edit `settings.json`:

```json
{
  "profiles": {
    "defaults": {
      "font": {
        "face": "Sergamon",
        "size": 16
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Alacritty</strong></summary>

Add to `alacritty.toml`:

```toml
[font]
size = 16.0

[font.normal]
family = "Sergamon"
```

</details>

## Web Usage

Use `@font-face` to load Sergamon in your web project:

```css
@font-face {
  font-family: 'Sergamon';
  src: url('/fonts/Sergamon.woff2') format('woff2'),
       url('/fonts/Sergamon.ttf') format('truetype');
  font-display: swap;
}

code, pre {
  font-family: 'Sergamon', monospace;
}
```

You can also load it directly from the project site:

```css
@font-face {
  font-family: 'Sergamon';
  src: url('https://sgmonda.com/sergamon/fonts/Sergamon.woff2') format('woff2');
  font-display: swap;
}
```

## How It Works

Sergamon treats glyph definitions as source code. Each character lives in a plain-text `.glyph` file -- an 8x16 pixel grid that a TypeScript pipeline compiles into vector font files.

```
# zero (U+0030)

........   . = empty pixel
........   X = filled pixel
........   8 columns wide
.XXXXX..  16 rows tall
XX...XX.
XX...XX.
XX..XXX.
XX.XXXX.
XXXX.XX.
XXX..XX.
XX...XX.
XX...XX.
.XXXXX..
........
........
........
```

**Build pipeline:**

```
.glyph files ──> parse ──> validate ──> optimize ──> vectorize ──> TTF ──> WOFF2
                  │          │            │             │
                  │          │            │             └─ opentype.js paths
                  │          │            └─ row-merge rectangles
                  │          └─ grid dimensions, ASCII completeness
                  └─ header + boolean[][] grid
```

The optimizer merges adjacent filled pixels into larger rectangles before converting to vector paths, keeping the output compact and efficient.

## Development

**Prerequisites:** Node.js >= 20

```bash
git clone https://github.com/sgmonda/sergamon.git
cd sergamon
npm ci
```

### Commands

| Command | Description |
|---|---|
| `npm run validate` | Lint all `.glyph` files for format errors |
| `npm run build` | Validate + compile glyphs into TTF/WOFF2 |
| `npm run dev` | Launch live preview server with file watching |
| `npm run previews` | Build fonts + generate PNG preview images |
| `npm run site` | Build fonts + copy WOFF2 to GitHub Pages site |
| `npm run all` | Build + previews |
| `npm run clean` | Remove `build/` directory |

### Project Structure

```
sergamon/
├── glyphs/
│   ├── ascii/          # 95 ASCII glyphs (U+0020 -- U+007E)
│   └── latin-ext/      # 12 Latin Extended glyphs (accents, ñ, ü, ...)
├── src/
│   ├── build-font.ts           # Main build orchestrator
│   ├── parse-glyph.ts          # .glyph file parser
│   ├── validate-glyphs.ts      # Glyph validator
│   ├── optimize-paths.ts       # Pixel → rectangle optimizer
│   ├── glyph-to-path.ts        # Rectangle → opentype.js path
│   ├── dev-preview.ts          # Dev server with live reload
│   ├── generate-previews.cjs   # PNG preview generator
│   └── opentype.d.ts           # Custom type declarations
├── site/                # GitHub Pages site
└── build/               # Generated output (TTF, WOFF2, PNGs)
```

## Contributing

Contributions are welcome -- whether refining an existing glyph, adding a new character, or improving the build pipeline. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide on:

- `.glyph` file format and naming conventions
- Pixel-art style guidelines
- Testing workflow (`validate`, `dev`, `all`)
- Pull request process

## License

**Font files and glyph sources** -- [SIL Open Font License 1.1](LICENSE)
**Build scripts and site code** -- MIT License
