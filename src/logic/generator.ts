import { Grid, isValid, countSolutions, classifyDifficulty, cloneGrid } from './solver';

export function createEmptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length;
  let randomIndex: number;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
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
            if (fillGrid(grid)) {
              return true;
            }
            grid[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

export function generatePuzzle(difficulty: 'Hard' | 'Very Hard'): { puzzle: Grid, solution: Grid } | null {
  const MAX_ATTEMPTS = 50;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = generateSolvedGrid();
    const puzzle = cloneGrid(solution);

    // Create a list of all 81 positions and shuffle them
    const positions: [number, number][] = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        positions.push([r, c]);
      }
    }
    shuffle(positions);

    // Punch holes
    for (const [r, c] of positions) {
      const backup = puzzle[r][c];
      puzzle[r][c] = 0;

      // Check if it still has a unique solution
      if (countSolutions(puzzle) !== 1) {
        // Put it back if it broke uniqueness
        puzzle[r][c] = backup;
      }
    }

    const currentDifficulty = classifyDifficulty(puzzle);
    if (currentDifficulty === difficulty) {
      return { puzzle, solution };
    }
  }

  return null; // Failed to generate after MAX_ATTEMPTS
}

