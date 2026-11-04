import { Grid, isValid, countSolutions, classifyDifficulty, cloneGrid, solveGrid } from './solver';

export function createEmptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function generateSolvedGrid(): Grid {
  const grid = createEmptyGrid();
  fillGrid(grid);
  return grid;
}

function fillGrid(grid: Grid): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of nums) {
          if (isValid(grid, row, col, num)) {
            grid[row][col] = num;
            if (fillGrid(grid)) return true;
            grid[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

/**
 * Generates a fingerprint string for a puzzle grid to detect duplicates.
 */
export function gridFingerprint(grid: Grid): string {
  return grid.map(row => row.join('')).join('');
}

/**
 * Generates a single puzzle of the requested difficulty.
 * Returns the puzzle, its solution, or null if it couldn't generate one.
 */
export function generatePuzzle(
  difficulty: 'Hard' | 'Very Hard',
  existingFingerprints: Set<string>
): { puzzle: Grid; solution: Grid } | null {
  const MAX_ATTEMPTS = 80;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = generateSolvedGrid();
    const puzzle = cloneGrid(solution);

    // Create a shuffled list of all 81 positions
    const positions: [number, number][] = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        positions.push([r, c]);
      }
    }
    shuffle(positions);

    // Remove clues one by one, verifying unique solution each time
    for (const [r, c] of positions) {
      const backup = puzzle[r][c];
      puzzle[r][c] = 0;

      if (countSolutions(puzzle) !== 1) {
        puzzle[r][c] = backup;
      }
    }

    // Check difficulty
    const currentDifficulty = classifyDifficulty(puzzle);
    if (currentDifficulty !== difficulty) continue;

    // Check uniqueness (dedup)
    const fp = gridFingerprint(puzzle);
    if (existingFingerprints.has(fp)) continue;

    // Verify the stored solution is correct by solving the puzzle independently
    const verified = solveGrid(puzzle);
    if (!verified) continue; // Should never happen, but safety check

    return { puzzle, solution: verified };
  }

  return null;
}
