/**
 * generate-previews.cjs
 *
 * Generates PNG preview images of sample code rendered in the Sergamon font.
 * Produces both light and dark theme variants for each language.
 *
 * Output: build/previews/preview-{language}.png (dark)
 *         build/previews/preview-{language}-light.png (light)
 * Size:   1200x800px
 *
 * Usage:  node src/generate-previews.cjs
 */

const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const { mkdirSync, writeFileSync, existsSync } = require("node:fs");
const { resolve, join } = require("node:path");

// ── Paths ────────────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, "..");
const BUILD_DIR = join(ROOT, "build");
const PREVIEWS_DIR = join(BUILD_DIR, "previews");
const FONT_PATH = join(BUILD_DIR, "Sergamon.ttf");

// ── Themes ───────────────────────────────────────────────────────────────────

const darkTheme = {
  name: "dark",
  suffix: "",
  bg: "#1a1e24",
  text: "#e6edf3",
  comment: "#8b949e",
  keyword: "#ff7b72",
  string: "#a5d6ff",
  number: "#79c0ff",
  function: "#d2a8ff",
  operator: "#ff7b72",
  lineNumber: "#484f58",
  lineNumberBg: "#161b22",
  gutterBorder: "#30363d",
  headerBg: "#161b22",
  headerText: "#8b949e",
  headerDot1: "#ff5f57",
  headerDot2: "#febc2e",
  headerDot3: "#28c840",
};

const lightTheme = {
  name: "light",
  suffix: "-light",
  bg: "#ffffff",
  text: "#1f2328",
  comment: "#6e7781",
  keyword: "#cf222e",
  string: "#0a3069",
  number: "#0550ae",
  function: "#8250df",
  operator: "#cf222e",
  lineNumber: "#8b949e",
  lineNumberBg: "#f6f8fa",
  gutterBorder: "#d0d7de",
  headerBg: "#f6f8fa",
  headerText: "#656d76",
  headerDot1: "#ff5f57",
  headerDot2: "#febc2e",
  headerDot3: "#28c840",
};

// ── Language-specific keywords ───────────────────────────────────────────────

const languageKeywords = {
  python: [
    "def",
    "class",
    "import",
    "from",
    "return",
    "if",
    "else",
    "elif",
    "for",
    "while",
    "in",
    "not",
    "and",
    "or",
    "True",
    "False",
    "None",
    "with",
    "as",
    "try",
    "except",
    "raise",
    "pass",
    "yield",
    "lambda",
    "self",
    "print",
    "range",
    "len",
    "int",
    "str",
    "list",
    "dict",
  ],
  javascript: [
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "class",
    "new",
    "this",
    "import",
    "export",
    "from",
    "async",
    "await",
    "try",
    "catch",
    "throw",
    "typeof",
    "instanceof",
    "true",
    "false",
    "null",
    "undefined",
    "console",
    "log",
  ],
  rust: [
    "fn",
    "let",
    "mut",
    "pub",
    "struct",
    "enum",
    "impl",
    "trait",
    "use",
    "mod",
    "crate",
    "self",
    "super",
    "return",
    "if",
    "else",
    "for",
    "while",
    "loop",
    "match",
    "in",
    "as",
    "ref",
    "move",
    "true",
    "false",
    "Some",
    "None",
    "Ok",
    "Err",
    "vec",
    "println",
    "where",
    "type",
    "const",
    "static",
    "unsafe",
    "async",
    "await",
  ],
};

// ── Simple tokenizer ─────────────────────────────────────────────────────────

const RE_DIGIT = /\d/;
const RE_HEX = /[\d._xXa-fA-F]/;
const RE_WORD_START = /[a-zA-Z_]/;
const RE_WORD = /[a-zA-Z0-9_]/;

function tokenize(line, language) {
  const tokens = [];
  const keywords = languageKeywords[language] || [];
  let i = 0;

  while (i < line.length) {
    // Comments
    if (line[i] === "#" && language === "python") {
      tokens.push({ type: "comment", value: line.slice(i) });
      break;
    }
    if (
      line[i] === "/" &&
      line[i + 1] === "/" &&
      (language === "javascript" || language === "rust")
    ) {
      tokens.push({ type: "comment", value: line.slice(i) });
      break;
    }

    // Strings (double or single quote)
    if (line[i] === '"' || line[i] === "'") {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === "\\") j++;
        j++;
      }
      j = Math.min(j + 1, line.length);
      tokens.push({ type: "string", value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Numbers
    if (RE_DIGIT.test(line[i])) {
      let j = i;
      while (j < line.length && RE_HEX.test(line[j])) j++;
      tokens.push({ type: "number", value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Operators
    if ("=!<>+-*/%&|^~".includes(line[i])) {
      let j = i;
      while (j < line.length && "=!<>+-*/%&|^~".includes(line[j])) j++;
      tokens.push({ type: "operator", value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Words (identifiers / keywords)
    if (RE_WORD_START.test(line[i])) {
      let j = i;
      while (j < line.length && RE_WORD.test(line[j])) j++;
      const word = line.slice(i, j);
      if (keywords.includes(word)) {
        tokens.push({ type: "keyword", value: word });
      } else if (j < line.length && line[j] === "(") {
        tokens.push({ type: "function", value: word });
      } else {
        tokens.push({ type: "text", value: word });
      }
      i = j;
      continue;
    }

    // Other characters (whitespace, punctuation)
    tokens.push({ type: "text", value: line[i] });
    i++;
  }

  return tokens;
}

// ── Code samples ─────────────────────────────────────────────────────────────

const samples = {
  python: `# Fibonacci with memoization
from functools import lru_cache

@lru_cache(maxsize=None)
def fibonacci(n: int) -> int:
    """Return the nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

class Matrix:
    def __init__(self, rows, cols):
        self.rows = rows
        self.cols = cols
        self.data = [[0.0] * cols for _ in range(rows)]

    def __eq__(self, other):
        return self.data == other.data

    def __ne__(self, other):
        return not self.__eq__(other)

# Test: 0 O o | 1 l I | \` ' "
result = fibonacci(30)  # => 832040
print(f"fib(30) == {result}")`,

  javascript: `// Event-driven task runner
const STATUS = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  DONE:    "done",
  FAILED:  "failed",
});

class TaskRunner {
  #tasks = new Map();
  #concurrency = 4;

  constructor(options = {}) {
    this.#concurrency = options.concurrency ?? 4;
  }

  add(name, fn) {
    if (this.#tasks.has(name)) {
      throw new Error("Task already exists");
    }
    this.#tasks.set(name, { fn, status: STATUS.PENDING });
  }

  async run() {
    const pending = [...this.#tasks.entries()]
      .filter(([, t]) => t.status === STATUS.PENDING);
    // 0 O o | 1 l I | \` ' "
    return pending;  // => [{name, result}]
  }
}`,

  rust: `// A simple linked list
use std::fmt;

#[derive(Debug, Clone)]
enum List<T> {
    Cons(T, Box<List<T>>),
    Nil,
}

impl<T: fmt::Display + PartialEq> List<T> {
    fn new() -> Self {
        List::Nil
    }

    fn push(self, value: T) -> Self {
        List::Cons(value, Box::new(self))
    }

    fn len(&self) -> usize {
        match self {
            List::Nil => 0,
            List::Cons(_, tail) => 1 + tail.len(),
        }
    }
}

// 0 O o | 1 l I | \` ' "
fn main() {
    let list = List::new().push(1).push(2);
    let size = list.len();  // => 2
    assert!(size != 0 && size >= 1 && size <= 100);
}`,
};

// ── Render a preview image ───────────────────────────────────────────────────

function renderPreview(language, code, theme) {
  const WIDTH = 1200;
  const HEIGHT = 800;
  const FONT_SIZE = 14;
  const LINE_HEIGHT = 22;
  const GUTTER_WIDTH = 52;
  const HEADER_HEIGHT = 36;
  const PADDING_LEFT = 16;
  const PADDING_TOP = 16;
  const FONT_NAME = "Sergamon";

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Window header bar
  ctx.fillStyle = theme.headerBg;
  ctx.fillRect(0, 0, WIDTH, HEADER_HEIGHT);
  ctx.fillStyle = theme.gutterBorder;
  ctx.fillRect(0, HEADER_HEIGHT - 1, WIDTH, 1);

  // Traffic light dots
  const dotY = HEADER_HEIGHT / 2;
  const dotRadius = 6;
  ctx.beginPath();
  ctx.arc(20, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = theme.headerDot1;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(40, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = theme.headerDot2;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(60, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = theme.headerDot3;
  ctx.fill();

  // Header title
  ctx.fillStyle = theme.headerText;
  ctx.font = `12px "${FONT_NAME}", monospace`;
  ctx.textBaseline = "middle";
  const ext = language === "rust" ? "rs" : language === "python" ? "py" : "js";
  ctx.fillText(`preview-${language}.${ext}`, 80, dotY);

  // Gutter background
  ctx.fillStyle = theme.lineNumberBg;
  ctx.fillRect(0, HEADER_HEIGHT, GUTTER_WIDTH, HEIGHT - HEADER_HEIGHT);

  // Gutter border
  ctx.fillStyle = theme.gutterBorder;
  ctx.fillRect(GUTTER_WIDTH, HEADER_HEIGHT, 1, HEIGHT - HEADER_HEIGHT);

  // Render lines
  const lines = code.split("\n");
  const startY = HEADER_HEIGHT + PADDING_TOP;

  ctx.font = `${FONT_SIZE}px "${FONT_NAME}", monospace`;
  ctx.textBaseline = "top";

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * LINE_HEIGHT;
    if (y > HEIGHT) break;

    // Line number
    ctx.fillStyle = theme.lineNumber;
    const lineNum = String(i + 1).padStart(3, " ");
    ctx.fillText(lineNum, 8, y);

    // Tokenize and render
    const tokens = tokenize(lines[i], language);
    let x = GUTTER_WIDTH + PADDING_LEFT;

    for (const token of tokens) {
      switch (token.type) {
        case "comment":
          ctx.fillStyle = theme.comment;
          break;
        case "keyword":
          ctx.fillStyle = theme.keyword;
          break;
        case "string":
          ctx.fillStyle = theme.string;
          break;
        case "number":
          ctx.fillStyle = theme.number;
          break;
        case "function":
          ctx.fillStyle = theme.function;
          break;
        case "operator":
          ctx.fillStyle = theme.operator;
          break;
        default:
          ctx.fillStyle = theme.text;
      }

      ctx.fillText(token.value, x, y);
      x += ctx.measureText(token.value).width;
    }
  }

  // Watermark
  ctx.fillStyle = theme.comment;
  ctx.font = `11px "${FONT_NAME}", monospace`;
  ctx.textBaseline = "bottom";
  ctx.fillText(
    "Sergamon - Monospaced font for nostalgic hackers",
    GUTTER_WIDTH + PADDING_LEFT,
    HEIGHT - 12,
  );

  return canvas.toBuffer("image/png");
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // Ensure output directory
  if (!existsSync(PREVIEWS_DIR)) {
    mkdirSync(PREVIEWS_DIR, { recursive: true });
  }

  // Register the font
  if (existsSync(FONT_PATH)) {
    GlobalFonts.registerFromPath(FONT_PATH, "Sergamon");
    console.log(`Registered font from ${FONT_PATH}`);
  } else {
    console.warn(
      `Warning: Font file not found at ${FONT_PATH}. Using fallback font.`,
    );
    console.warn('Run "npm run build" first to generate font files.');
  }

  const themes = [darkTheme, lightTheme];
  const languages = Object.keys(samples);

  let count = 0;
  for (const language of languages) {
    const code = samples[language];
    for (const theme of themes) {
      const buffer = renderPreview(language, code, theme);
      const filename = `preview-${language}${theme.suffix}.png`;
      const outPath = join(PREVIEWS_DIR, filename);

      writeFileSync(outPath, buffer);
      console.log(`Generated: ${filename} (${buffer.length} bytes)`);
      count++;
    }
  }

  console.log(`\nDone. Generated ${count} preview images in ${PREVIEWS_DIR}`);
}

main();
