import { Grid, isValid, countSolutions, classifyDifficulty, cloneGrid, solveGrid } from './solver';

export type ExcavationArchetype = 'rotational180' | 'mirror' | 'boxBalanced' | 'asymmetric';

const ARCHETYPES: ExcavationArchetype[] = [
  'rotational180',
  'mirror',
  'boxBalanced',
  'asymmetric'
];

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
 * Applies valid Sudoku symmetries (digit relabeling, band/stack/row/col permutations,
 * and dihedral rotation/transposition) so solved grids explore the full solution space.
 */
export function applyRandomTransform(grid: Grid): Grid {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const digitMap = [0, ...digits];

  const bandOrder = shuffle([0, 1, 2]);
  const stackOrder = shuffle([0, 1, 2]);

  const rowOrder: number[] = [];
  for (const b of bandOrder) {
    for (const r of shuffle([0, 1, 2])) {
      rowOrder.push(b * 3 + r);
    }
  }

  const colOrder: number[] = [];
  for (const s of stackOrder) {
    for (const c of shuffle([0, 1, 2])) {
      colOrder.push(s * 3 + c);
    }
  }

  const permuted: Grid = Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => digitMap[grid[rowOrder[r]][colOrder[c]]])
  );

  // Dihedral symmetry (0..7): transpose flag + 0/90/180/270 rotation
  const transpose = Math.random() < 0.5;
  const rotations = Math.floor(Math.random() * 4);

  let result = permuted;
  if (transpose) {
    result = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => result[c][r]));
  }
  for (let k = 0; k < rotations; k++) {
    const prev = result;
    result = Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => prev[8 - c][r])
    );
  }

  return result;
}

export function generateSolvedGrid(): Grid {
  const grid = createEmptyGrid();
  fillGrid(grid);
  return applyRandomTransform(grid);
}

/**
 * Generates a fingerprint string for a puzzle grid to detect duplicates.
 */
export function gridFingerprint(grid: Grid): string {
  return grid.map(row => row.join('')).join('');
}

/**
 * Generates a clue-mask fingerprint ('1' for given, '0' for blank)
 * to avoid repeating the exact same visual clue layout across puzzles.
 */
export function maskFingerprint(grid: Grid): string {
  return grid.map(row => row.map(v => (v > 0 ? '1' : '0')).join('')).join('');
}

function boxOf(r: number, c: number): number {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

function buildSymmetricGroups(
  partnerFn: (r: number, c: number) => [number, number]
): [number, number][][] {
  const visited = Array.from({ length: 9 }, () => Array(9).fill(false));
  const groups: [number, number][][] = [];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (visited[r][c]) continue;
      visited[r][c] = true;
      const [pr, pc] = partnerFn(r, c);
      if (pr === r && pc === c) {
        groups.push([[r, c]]);
      } else {
        visited[pr][pc] = true;
        groups.push([
          [r, c],
          [pr, pc]
        ]);
      }
    }
  }

  return shuffle(groups);
}

function buildGroupOrder(archetype: ExcavationArchetype): [number, number][][] {
  if (archetype === 'rotational180') {
    return buildSymmetricGroups((r, c) => [8 - r, 8 - c]);
  }
  if (archetype === 'mirror') {
    const mode = Math.floor(Math.random() * 3);
    if (mode === 0) return buildSymmetricGroups((r, c) => [r, 8 - c]);
    if (mode === 1) return buildSymmetricGroups((r, c) => [8 - r, c]);
    return buildSymmetricGroups((r, c) => [c, r]);
  }

  const singles: [number, number][][] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      singles.push([[r, c]]);
    }
  }
  return shuffle(singles);
}

/**
 * Generates a single puzzle of the requested difficulty.
 * Returns the puzzle, its solution, or null if it couldn't generate one.
 */
export function generatePuzzle(
  difficulty: 'Hard' | 'Very Hard',
  existingFingerprints: Set<string>,
  styleHint?: number
): { puzzle: Grid; solution: Grid } | null {
  const MAX_ATTEMPTS = 120;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const archetype = ARCHETYPES[((styleHint ?? 0) + attempt) % ARCHETYPES.length];
    const targetMinClues =
      difficulty === 'Hard'
        ? 24 + Math.floor(Math.random() * 5) // 24..28
        : 21 + Math.floor(Math.random() * 5); // 21..25

    const solution = generateSolvedGrid();
    const puzzle = cloneGrid(solution);

    let cluesCount = 81;
    const rowClues = Array(9).fill(9);
    const colClues = Array(9).fill(9);
    const boxClues = Array(9).fill(9);
    let lastDiff: 'Easy' | 'Hard' | 'Very Hard' | 'Unsolvable' = 'Easy';

    const tryRemoveGroup = (
      group: [number, number][]
    ): 'Easy' | 'Hard' | 'Very Hard' | 'Unsolvable' | null => {
      const cells = group.filter(([r, c]) => puzzle[r][c] !== 0);
      if (cells.length === 0) return null;

      // Simulate clue count drop per house so no row/col/box loses all clues
      const tempRow = [...rowClues];
      const tempCol = [...colClues];
      const tempBox = [...boxClues];
      for (const [r, c] of cells) {
        tempRow[r]--;
        tempCol[c]--;
        tempBox[boxOf(r, c)]--;
        if (tempRow[r] < 1 || tempCol[c] < 1 || tempBox[boxOf(r, c)] < 1) {
          return null;
        }
      }

      const backups = cells.map(([r, c]) => puzzle[r][c]);
      for (const [r, c] of cells) {
        puzzle[r][c] = 0;
      }

      if (countSolutions(puzzle) !== 1) {
        cells.forEach(([r, c], idx) => {
          puzzle[r][c] = backups[idx];
        });
        return null;
      }

      const nextClues = cluesCount - cells.length;
      let stepDiff: 'Easy' | 'Hard' | 'Very Hard' | 'Unsolvable' = 'Easy';
      if (nextClues <= 30) {
        const d = classifyDifficulty(puzzle);
        if (d === 'Unsolvable' || (difficulty === 'Hard' && d === 'Very Hard')) {
          cells.forEach(([r, c], idx) => {
            puzzle[r][c] = backups[idx];
          });
          return null;
        }
        stepDiff = d;
        lastDiff = d;
      }

      cluesCount = nextClues;
      for (const [r, c] of cells) {
        rowClues[r]--;
        colClues[c]--;
        boxClues[boxOf(r, c)]--;
      }
      return stepDiff;
    };

    // Phase 1: Archetype-guided excavation
    if (archetype === 'boxBalanced') {
      const tried = Array.from({ length: 9 }, () => Array(9).fill(false));
      while (cluesCount > targetMinClues) {
        let maxBox = 0;
        const candidates: { r: number; c: number; box: number; score: number }[] = [];

        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (tried[r][c] || puzzle[r][c] === 0) continue;
            const b = boxOf(r, c);
            if (rowClues[r] <= 1 || colClues[c] <= 1 || boxClues[b] <= 1) continue;
            if (boxClues[b] > maxBox) maxBox = boxClues[b];
            candidates.push({
              r,
              c,
              box: b,
              score: rowClues[r] + colClues[c] + Math.random() * 2.5
            });
          }
        }

        const top = candidates.filter(item => item.box === maxBox);
        if (top.length === 0) break;

        top.sort((a, b) => b.score - a.score);
        const pick = top[0];
        tried[pick.r][pick.c] = true;
        tryRemoveGroup([[pick.r, pick.c]]);
      }
    } else {
      const groups = buildGroupOrder(archetype);
      for (const group of groups) {
        if (cluesCount <= targetMinClues) break;
        if (group.length > 1 && cluesCount - group.length < targetMinClues - 1) continue;
        tryRemoveGroup(group);
      }
    }

    // Phase 2: Cell-by-cell refinement if target difficulty wasn't reached yet
    let currentDifficulty = cluesCount <= 30 ? lastDiff : classifyDifficulty(puzzle);
    if (currentDifficulty !== difficulty) {
      const remaining: [number, number][] = [];
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (puzzle[r][c] !== 0) remaining.push([r, c]);
        }
      }
      shuffle(remaining);

      const minFloor = difficulty === 'Very Hard' ? 19 : 21;
      for (const [r, c] of remaining) {
        if (cluesCount <= minFloor) break;
        const stepDiff = tryRemoveGroup([[r, c]]);
        if (stepDiff !== null && cluesCount <= 30 && stepDiff === difficulty) {
          currentDifficulty = stepDiff;
          break;
        }
      }
      currentDifficulty = classifyDifficulty(puzzle);
    }

    if (currentDifficulty !== difficulty) continue;

    // Check uniqueness (both full grid and visual clue layout)
    const fp = gridFingerprint(puzzle);
    const mfp = maskFingerprint(puzzle);
    if (existingFingerprints.has(fp) || existingFingerprints.has(mfp)) continue;

    const verified = solveGrid(puzzle);
    if (!verified) continue;

    return { puzzle, solution: verified };
  }

  return null;
}
