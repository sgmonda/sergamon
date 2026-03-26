/**
 * Mini-font: 3×5 pixel bitmaps for rendering text inside 8×16 glyph grids.
 * Used by generation scripts for variation selectors and tags block.
 */

export const MINI: Record<string, string[]> = {
  // Digits
  '0': ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
  '1': ['.X.', 'XX.', '.X.', '.X.', 'XXX'],
  '2': ['XXX', '..X', 'XXX', 'X..', 'XXX'],
  '3': ['XXX', '..X', 'XXX', '..X', 'XXX'],
  '4': ['X.X', 'X.X', 'XXX', '..X', '..X'],
  '5': ['XXX', 'X..', 'XXX', '..X', 'XXX'],
  '6': ['XXX', 'X..', 'XXX', 'X.X', 'XXX'],
  '7': ['XXX', '..X', '..X', '.X.', '.X.'],
  '8': ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
  '9': ['XXX', 'X.X', 'XXX', '..X', 'XXX'],

  // Uppercase hex + full alphabet
  'A': ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
  'B': ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
  'C': ['XXX', 'X..', 'X..', 'X..', 'XXX'],
  'D': ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
  'E': ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
  'F': ['XXX', 'X..', 'XX.', 'X..', 'X..'],
  'G': ['XXX', 'X..', 'X.X', 'X.X', 'XXX'],
  'H': ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
  'I': ['XXX', '.X.', '.X.', '.X.', 'XXX'],
  'J': ['..X', '..X', '..X', 'X.X', 'XXX'],
  'K': ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'],
  'L': ['X..', 'X..', 'X..', 'X..', 'XXX'],
  'M': ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'],
  'N': ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'],
  'O': ['.X.', 'X.X', 'X.X', 'X.X', '.X.'],
  'P': ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
  'Q': ['.X.', 'X.X', 'X.X', 'XXX', '.XX'],
  'R': ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'],
  'S': ['XXX', 'X..', 'XXX', '..X', 'XXX'],
  'T': ['XXX', '.X.', '.X.', '.X.', '.X.'],
  'U': ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'],
  'V': ['X.X', 'X.X', 'X.X', '.X.', '.X.'],
  'W': ['X.X', 'X.X', 'XXX', 'XXX', 'X.X'],
  'X': ['X.X', 'X.X', '.X.', 'X.X', 'X.X'],
  'Y': ['X.X', 'X.X', '.X.', '.X.', '.X.'],
  'Z': ['XXX', '..X', '.X.', 'X..', 'XXX'],

  // Lowercase
  'a': ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
  'b': ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
  'c': ['XXX', 'X..', 'X..', 'X..', 'XXX'],
  'd': ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
  'e': ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
  'f': ['XXX', 'X..', 'XX.', 'X..', 'X..'],
  'g': ['XXX', 'X..', 'X.X', 'X.X', 'XXX'],
  'h': ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
  'i': ['XXX', '.X.', '.X.', '.X.', 'XXX'],
  'j': ['..X', '..X', '..X', 'X.X', 'XXX'],
  'k': ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'],
  'l': ['X..', 'X..', 'X..', 'X..', 'XXX'],
  'm': ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'],
  'n': ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'],
  'o': ['.X.', 'X.X', 'X.X', 'X.X', '.X.'],
  'p': ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
  'q': ['.X.', 'X.X', 'X.X', 'XXX', '.XX'],
  'r': ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'],
  's': ['XXX', 'X..', 'XXX', '..X', 'XXX'],
  't': ['XXX', '.X.', '.X.', '.X.', '.X.'],
  'u': ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'],
  'v': ['X.X', 'X.X', 'X.X', '.X.', '.X.'],
  'w': ['X.X', 'X.X', 'XXX', 'XXX', 'X.X'],
  'x': ['X.X', 'X.X', '.X.', 'X.X', 'X.X'],
  'y': ['X.X', 'X.X', '.X.', '.X.', '.X.'],
  'z': ['XXX', '..X', '.X.', 'X..', 'XXX'],

  // Punctuation & symbols used in caret notation and tags
  ' ': ['...', '...', '...', '...', '...'],
  '!': ['.X.', '.X.', '.X.', '...', '.X.'],
  '"': ['X.X', 'X.X', '...', '...', '...'],
  '#': ['X.X', 'XXX', 'X.X', 'XXX', 'X.X'],
  '$': ['.X.', 'XXX', '.X.', 'XXX', '.X.'],
  '%': ['X.X', '..X', '.X.', 'X..', 'X.X'],
  '&': ['.X.', 'X.X', '.XX', 'X.X', '.XX'],
  "'": ['.X.', '.X.', '...', '...', '...'],
  '(': ['.X.', 'X..', 'X..', 'X..', '.X.'],
  ')': ['.X.', '..X', '..X', '..X', '.X.'],
  '*': ['X.X', '.X.', 'XXX', '.X.', 'X.X'],
  '+': ['...', '.X.', 'XXX', '.X.', '...'],
  ',': ['...', '...', '...', '.X.', 'X..'],
  '-': ['...', '...', 'XXX', '...', '...'],
  '.': ['...', '...', '...', '...', '.X.'],
  '/': ['..X', '..X', '.X.', 'X..', 'X..'],
  ':': ['...', '.X.', '...', '.X.', '...'],
  ';': ['...', '.X.', '...', '.X.', 'X..'],
  '<': ['..X', '.X.', 'X..', '.X.', '..X'],
  '=': ['...', 'XXX', '...', 'XXX', '...'],
  '>': ['X..', '.X.', '..X', '.X.', 'X..'],
  '?': ['XXX', '..X', '.X.', '...', '.X.'],
  '@': ['XXX', 'X.X', 'XXX', 'X..', 'XXX'],
  '[': ['XX.', 'X..', 'X..', 'X..', 'XX.'],
  '\\': ['X..', 'X..', '.X.', '..X', '..X'],
  ']': ['.XX', '..X', '..X', '..X', '.XX'],
  '^': ['.X.', 'X.X', '...', '...', '...'],
  '_': ['...', '...', '...', '...', 'XXX'],
  '`': ['X..', '.X.', '...', '...', '...'],
  '{': ['.X.', 'X..', 'X..', 'X..', '.X.'],
  '|': ['.X.', '.X.', '.X.', '.X.', '.X.'],
  '}': ['.X.', '..X', '..X', '..X', '.X.'],
  '~': ['...', '.XX', 'XX.', '...', '...'],
};

/** Create an empty 8×16 grid */
export function emptyGrid(): string[] {
  return Array.from({ length: 16 }, () => '........');
}

/** Set a single pixel in a grid row */
function setPixel(row: string, col: number, on: boolean): string {
  const chars = row.split('');
  chars[col] = on ? 'X' : '.';
  return chars.join('');
}

/** Stamp a mini-char bitmap onto a grid at (startRow, startCol) */
export function stampChar(grid: string[], ch: string, startRow: number, startCol: number): void {
  const bitmap = MINI[ch];
  if (!bitmap) return;
  for (let r = 0; r < bitmap.length; r++) {
    for (let c = 0; c < bitmap[r].length; c++) {
      if (bitmap[r][c] === 'X') {
        grid[startRow + r] = setPixel(grid[startRow + r], startCol + c, true);
      }
    }
  }
}

/** Add dotted corner frame markers at rows 1,14 cols 0,7 */
export function addCornerFrame(grid: string[]): void {
  grid[1] = setPixel(grid[1], 0, true);
  grid[1] = setPixel(grid[1], 7, true);
  grid[14] = setPixel(grid[14], 0, true);
  grid[14] = setPixel(grid[14], 7, true);
}

/** Format a glyph file content */
export function formatGlyph(label: string, codepoint: number, grid: string[]): string {
  const hex = codepoint.toString(16).toUpperCase().padStart(4, '0');
  const cpStr = codepoint > 0xFFFF
    ? `U+${hex}`
    : `U+${hex}`;
  return `# ${label} (${cpStr})\n\n${grid.join('\n')}\n`;
}
