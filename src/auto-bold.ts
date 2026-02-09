/**
 * Auto-generates a bold weight variant from a regular glyph grid.
 *
 * The algorithm expands each filled pixel one step to the right, which
 * produces a visually heavier stroke suitable for a bold weight when no
 * hand-designed bold variant exists.
 *
 * Usage:
 *   import { autoBold } from './auto-bold.js';
 *   const boldGrid = autoBold(regularGrid);
 */

/**
 * Produce a bold variant of a pixel grid by expanding each filled pixel
 * one column to the right.
 *
 * @param grid - The source boolean[][] grid (grid[row][col]).
 * @returns A new boolean[][] grid with the bold expansion applied.
 *          The original grid is not mutated.
 */
export function autoBold(grid: boolean[][]): boolean[][] {
  const rows = grid.length;
  if (rows === 0) return [];

  // Create a deep copy so we don't mutate the original.
  const bold: boolean[][] = grid.map((row) => [...row]);

  for (let row = 0; row < rows; row++) {
    const cols = grid[row].length;
    for (let col = 0; col < cols; col++) {
      if (grid[row][col] && col + 1 < cols) {
        bold[row][col + 1] = true;
      }
    }
  }

  return bold;
}
