export type Grid = number[][];

export function cloneGrid(grid: Grid): Grid {
  return grid.map(row => [...row]);
}

export function isValid(grid: Grid, row: number, col: number, num: number): boolean {
  for (let x = 0; x < 9; x++) {
    if (grid[row][x] === num) return false;
    if (grid[x][col] === num) return false;
  }
  const startRow = row - row % 3;
  const startCol = col - col % 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (grid[i + startRow][j + startCol] === num) return false;
    }
  }
  return true;
}

/**
 * Counts solutions for the given puzzle, stopping early at 2.
 * IMPORTANT: Clones the grid internally to avoid mutating the caller's data.
 */
export function countSolutions(originalGrid: Grid): number {
  const grid = cloneGrid(originalGrid);
  let count = 0;

  function solve(): void {
    if (count >= 2) return;
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === 0) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(grid, row, col, num)) {
              grid[row][col] = num;
              solve();
              grid[row][col] = 0;
              if (count >= 2) return;
            }
          }
          return;
        }
      }
    }
    count++;
  }

  solve();
  return count;
}

/**
 * Solves the puzzle via backtracking and returns the solved grid,
 * or null if no solution exists. Does NOT mutate the input.
 */
export function solveGrid(originalGrid: Grid): Grid | null {
  const grid = cloneGrid(originalGrid);

  function solve(): boolean {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === 0) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(grid, row, col, num)) {
              grid[row][col] = num;
              if (solve()) return true;
              grid[row][col] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  return solve() ? grid : null;
}

// ========== LOGICAL SOLVER & DIFFICULTY CLASSIFIER ==========

export type TechniqueLevel =
  | 'Basic'        // Naked/Hidden Singles
  | 'Intermediate' // Pairs, Pointing, Box-Line
  | 'Advanced'     // X-Wing, Swordfish, XY-Wing
  | 'Guessing';    // Requires Backtracking

function getCandidates(grid: Grid): Set<number>[][] {
  const candidates: Set<number>[][] = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set<number>())
  );

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(grid, r, c, num)) {
            candidates[r][c].add(num);
          }
        }
      }
    }
  }
  return candidates;
}

function eliminateFromPeers(candidates: Set<number>[][], num: number, r: number, c: number): void {
  // Row
  for (let i = 0; i < 9; i++) {
    if (i !== c) candidates[r][i].delete(num);
  }
  // Column
  for (let i = 0; i < 9; i++) {
    if (i !== r) candidates[i][c].delete(num);
  }
  // Box
  const br = r - (r % 3);
  const bc = c - (c % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const rr = br + i;
      const cc = bc + j;
      if (rr !== r || cc !== c) candidates[rr][cc].delete(num);
    }
  }
}

// ---------- helper: get all cells in a "house" (row/col/box) ----------
function getBoxCells(box: number): [number, number][] {
  const br = Math.floor(box / 3) * 3;
  const bc = (box % 3) * 3;
  const cells: [number, number][] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      cells.push([br + i, bc + j]);
  return cells;
}

// ============ Techniques ============

function nakedSingles(grid: Grid, cands: Set<number>[][]): boolean {
  let found = false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0 && cands[r][c].size === 1) {
        const val = cands[r][c].values().next().value!;
        grid[r][c] = val;
        cands[r][c].clear();
        eliminateFromPeers(cands, val, r, c);
        found = true;
      }
    }
  }
  return found;
}

function hiddenSingles(grid: Grid, cands: Set<number>[][]): boolean {
  let found = false;

  // Helper: try to place `num` as hidden single in a list of cells
  function tryHouse(cells: [number, number][]): void {
    for (let num = 1; num <= 9; num++) {
      const spots: [number, number][] = [];
      for (const [r, c] of cells) {
        if (cands[r][c].has(num)) spots.push([r, c]);
      }
      if (spots.length === 1) {
        const [r, c] = spots[0];
        if (grid[r][c] === 0) {
          grid[r][c] = num;
          cands[r][c].clear();
          eliminateFromPeers(cands, num, r, c);
          found = true;
        }
      }
    }
  }

  // Rows
  for (let r = 0; r < 9; r++) {
    const cells: [number, number][] = [];
    for (let c = 0; c < 9; c++) cells.push([r, c]);
    tryHouse(cells);
  }
  // Columns
  for (let c = 0; c < 9; c++) {
    const cells: [number, number][] = [];
    for (let r = 0; r < 9; r++) cells.push([r, c]);
    tryHouse(cells);
  }
  // Boxes
  for (let b = 0; b < 9; b++) tryHouse(getBoxCells(b));

  return found;
}

function pointingPairs(cands: Set<number>[][]): boolean {
  let found = false;

  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3;
    const bc = (b % 3) * 3;

    for (let num = 1; num <= 9; num++) {
      const rows = new Set<number>();
      const cols = new Set<number>();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (cands[br + i][bc + j].has(num)) {
            rows.add(br + i);
            cols.add(bc + j);
          }
        }
      }

      // Pointing row: all candidates for `num` in this box lie in one row
      if (rows.size === 1) {
        const r = rows.values().next().value!;
        for (let c = 0; c < 9; c++) {
          if (c < bc || c >= bc + 3) {
            if (cands[r][c].delete(num)) found = true;
          }
        }
      }

      // Pointing col
      if (cols.size === 1) {
        const c = cols.values().next().value!;
        for (let r = 0; r < 9; r++) {
          if (r < br || r >= br + 3) {
            if (cands[r][c].delete(num)) found = true;
          }
        }
      }
    }
  }

  // Box-line reduction (row → box)
  for (let num = 1; num <= 9; num++) {
    for (let r = 0; r < 9; r++) {
      const boxes = new Set<number>();
      for (let c = 0; c < 9; c++) {
        if (cands[r][c].has(num)) {
          boxes.add(Math.floor(c / 3));
        }
      }
      if (boxes.size === 1) {
        const boxCol = boxes.values().next().value! * 3;
        const br = r - (r % 3);
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const rr = br + i;
            const cc = boxCol + j;
            if (rr !== r && cands[rr][cc].has(num)) {
              if (cands[rr][cc].delete(num)) found = true;
            }
          }
        }
      }
    }
    // Box-line reduction (col → box)
    for (let c = 0; c < 9; c++) {
      const boxes = new Set<number>();
      for (let r = 0; r < 9; r++) {
        if (cands[r][c].has(num)) {
          boxes.add(Math.floor(r / 3));
        }
      }
      if (boxes.size === 1) {
        const boxRow = boxes.values().next().value! * 3;
        const bc = c - (c % 3);
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const rr = boxRow + i;
            const cc = bc + j;
            if (cc !== c && cands[rr][cc].has(num)) {
              if (cands[rr][cc].delete(num)) found = true;
            }
          }
        }
      }
    }
  }

  return found;
}

function nakedPairs(cands: Set<number>[][]): boolean {
  let found = false;

  function processHouse(cells: [number, number][]): void {
    for (let a = 0; a < cells.length - 1; a++) {
      const [ra, ca] = cells[a];
      if (cands[ra][ca].size !== 2) continue;
      for (let b2 = a + 1; b2 < cells.length; b2++) {
        const [rb, cb] = cells[b2];
        if (cands[rb][cb].size !== 2) continue;
        // Check same pair
        const valsA = Array.from(cands[ra][ca]);
        if (!valsA.every(v => cands[rb][cb].has(v))) continue;
        const [v1, v2] = valsA;
        for (const [rx, cx] of cells) {
          if ((rx === ra && cx === ca) || (rx === rb && cx === cb)) continue;
          if (cands[rx][cx].delete(v1)) found = true;
          if (cands[rx][cx].delete(v2)) found = true;
        }
      }
    }
  }

  // Rows
  for (let r = 0; r < 9; r++) {
    const cells: [number, number][] = [];
    for (let c = 0; c < 9; c++) if (cands[r][c].size > 0) cells.push([r, c]);
    processHouse(cells);
  }
  // Columns
  for (let c = 0; c < 9; c++) {
    const cells: [number, number][] = [];
    for (let r = 0; r < 9; r++) if (cands[r][c].size > 0) cells.push([r, c]);
    processHouse(cells);
  }
  // Boxes
  for (let b = 0; b < 9; b++) {
    const allCells = getBoxCells(b);
    const cells = allCells.filter(([r, c]) => cands[r][c].size > 0);
    processHouse(cells);
  }

  return found;
}

function nakedTriples(cands: Set<number>[][]): boolean {
  let found = false;

  function processHouse(cells: [number, number][]): void {
    const eligible = cells.filter(([r, c]) => cands[r][c].size >= 2 && cands[r][c].size <= 3);
    if (eligible.length < 3) return;

    for (let a = 0; a < eligible.length - 2; a++) {
      for (let b2 = a + 1; b2 < eligible.length - 1; b2++) {
        for (let c2 = b2 + 1; c2 < eligible.length; c2++) {
          const union = new Set<number>();
          for (const v of cands[eligible[a][0]][eligible[a][1]]) union.add(v);
          for (const v of cands[eligible[b2][0]][eligible[b2][1]]) union.add(v);
          for (const v of cands[eligible[c2][0]][eligible[c2][1]]) union.add(v);
          if (union.size !== 3) continue;

          for (const [rx, cx] of cells) {
            if ([a, b2, c2].some(idx => eligible[idx][0] === rx && eligible[idx][1] === cx)) continue;
            for (const v of union) {
              if (cands[rx][cx].delete(v)) found = true;
            }
          }
        }
      }
    }
  }

  for (let r = 0; r < 9; r++) {
    const cells: [number, number][] = [];
    for (let c = 0; c < 9; c++) if (cands[r][c].size > 0) cells.push([r, c]);
    processHouse(cells);
  }
  for (let c = 0; c < 9; c++) {
    const cells: [number, number][] = [];
    for (let r = 0; r < 9; r++) if (cands[r][c].size > 0) cells.push([r, c]);
    processHouse(cells);
  }
  for (let b = 0; b < 9; b++) {
    const cells = getBoxCells(b).filter(([r, c]) => cands[r][c].size > 0);
    processHouse(cells);
  }

  return found;
}

function xWing(cands: Set<number>[][]): boolean {
  let found = false;

  for (let num = 1; num <= 9; num++) {
    // Row-based X-Wing
    const rowInfo: { r: number; cols: number[] }[] = [];
    for (let r = 0; r < 9; r++) {
      const cols: number[] = [];
      for (let c = 0; c < 9; c++) {
        if (cands[r][c].has(num)) cols.push(c);
      }
      if (cols.length === 2) rowInfo.push({ r, cols });
    }
    for (let i = 0; i < rowInfo.length - 1; i++) {
      for (let j = i + 1; j < rowInfo.length; j++) {
        if (rowInfo[i].cols[0] === rowInfo[j].cols[0] && rowInfo[i].cols[1] === rowInfo[j].cols[1]) {
          const c1 = rowInfo[i].cols[0];
          const c2 = rowInfo[i].cols[1];
          for (let r = 0; r < 9; r++) {
            if (r !== rowInfo[i].r && r !== rowInfo[j].r) {
              if (cands[r][c1].delete(num)) found = true;
              if (cands[r][c2].delete(num)) found = true;
            }
          }
        }
      }
    }

    // Column-based X-Wing
    const colInfo: { c: number; rows: number[] }[] = [];
    for (let c = 0; c < 9; c++) {
      const rows: number[] = [];
      for (let r = 0; r < 9; r++) {
        if (cands[r][c].has(num)) rows.push(r);
      }
      if (rows.length === 2) colInfo.push({ c, rows });
    }
    for (let i = 0; i < colInfo.length - 1; i++) {
      for (let j = i + 1; j < colInfo.length; j++) {
        if (colInfo[i].rows[0] === colInfo[j].rows[0] && colInfo[i].rows[1] === colInfo[j].rows[1]) {
          const r1 = colInfo[i].rows[0];
          const r2 = colInfo[i].rows[1];
          for (let c = 0; c < 9; c++) {
            if (c !== colInfo[i].c && c !== colInfo[j].c) {
              if (cands[r1][c].delete(num)) found = true;
              if (cands[r2][c].delete(num)) found = true;
            }
          }
        }
      }
    }
  }

  return found;
}

function swordfish(cands: Set<number>[][]): boolean {
  let found = false;

  for (let num = 1; num <= 9; num++) {
    // Row-based Swordfish
    const rowInfo: { r: number; cols: number[] }[] = [];
    for (let r = 0; r < 9; r++) {
      const cols: number[] = [];
      for (let c = 0; c < 9; c++) {
        if (cands[r][c].has(num)) cols.push(c);
      }
      if (cols.length >= 2 && cols.length <= 3) rowInfo.push({ r, cols });
    }

    for (let a = 0; a < rowInfo.length - 2; a++) {
      for (let b2 = a + 1; b2 < rowInfo.length - 1; b2++) {
        for (let c2 = b2 + 1; c2 < rowInfo.length; c2++) {
          const colUnion = new Set<number>();
          for (const c of rowInfo[a].cols) colUnion.add(c);
          for (const c of rowInfo[b2].cols) colUnion.add(c);
          for (const c of rowInfo[c2].cols) colUnion.add(c);
          if (colUnion.size !== 3) continue;

          const usedRows = new Set([rowInfo[a].r, rowInfo[b2].r, rowInfo[c2].r]);
          for (const col of colUnion) {
            for (let r = 0; r < 9; r++) {
              if (!usedRows.has(r)) {
                if (cands[r][col].delete(num)) found = true;
              }
            }
          }
        }
      }
    }
  }

  return found;
}

function xyWing(cands: Set<number>[][]): boolean {
  let found = false;

  // Find all bi-value cells
  const biCells: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (cands[r][c].size === 2) biCells.push([r, c]);
    }
  }

  function arePeers(r1: number, c1: number, r2: number, c2: number): boolean {
    if (r1 === r2) return true;
    if (c1 === c2) return true;
    if (Math.floor(r1 / 3) === Math.floor(r2 / 3) && Math.floor(c1 / 3) === Math.floor(c2 / 3)) return true;
    return false;
  }

  for (const [pr, pc] of biCells) {
    const pVals = Array.from(cands[pr][pc]);
    const [x, y] = pVals;

    // Find wings: cells that are peers of pivot and share one candidate
    const wingsX: [number, number, number][] = []; // cells with X and Z (not Y)
    const wingsY: [number, number, number][] = []; // cells with Y and Z (not X)

    for (const [wr, wc] of biCells) {
      if (wr === pr && wc === pc) continue;
      if (!arePeers(pr, pc, wr, wc)) continue;
      const wVals = Array.from(cands[wr][wc]);
      if (wVals.includes(x) && !wVals.includes(y)) {
        const z = wVals[0] === x ? wVals[1] : wVals[0];
        wingsX.push([wr, wc, z]);
      }
      if (wVals.includes(y) && !wVals.includes(x)) {
        const z = wVals[0] === y ? wVals[1] : wVals[0];
        wingsY.push([wr, wc, z]);
      }
    }

    // Try to form XY-Wing: pivot {X,Y}, wing1 {X,Z}, wing2 {Y,Z}
    for (const [w1r, w1c, z1] of wingsX) {
      for (const [w2r, w2c, z2] of wingsY) {
        if (z1 !== z2) continue;
        const z = z1;
        // Eliminate Z from cells that see both wings
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (r === w1r && c === w1c) continue;
            if (r === w2r && c === w2c) continue;
            if (r === pr && c === pc) continue;
            if (arePeers(r, c, w1r, w1c) && arePeers(r, c, w2r, w2c)) {
              if (cands[r][c].delete(z)) found = true;
            }
          }
        }
      }
    }
  }

  return found;
}

// ============ Main classifier ============

export function classifyDifficulty(originalGrid: Grid): 'Easy' | 'Hard' | 'Very Hard' {
  const grid = cloneGrid(originalGrid);
  const cands = getCandidates(grid);

  let maxTechnique: TechniqueLevel = 'Basic';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // --- Level: Basic ---
    if (nakedSingles(grid, cands)) continue;
    if (hiddenSingles(grid, cands)) continue;

    // --- Level: Intermediate ---
    if (pointingPairs(cands)) { maxTechnique = maxTechnique === 'Basic' ? 'Intermediate' : maxTechnique; continue; }
    if (nakedPairs(cands))    { maxTechnique = maxTechnique === 'Basic' ? 'Intermediate' : maxTechnique; continue; }
    if (nakedTriples(cands))  { maxTechnique = maxTechnique === 'Basic' ? 'Intermediate' : maxTechnique; continue; }

    // --- Level: Advanced ---
    if (xWing(cands))     { maxTechnique = 'Advanced'; continue; }
    if (swordfish(cands)) { maxTechnique = 'Advanced'; continue; }
    if (xyWing(cands))    { maxTechnique = 'Advanced'; continue; }

    // Stuck — no technique made progress
    break;
  }

  // Check if fully solved
  let solved = true;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) { solved = false; break; }
    }
    if (!solved) break;
  }

  if (solved) {
    if (maxTechnique === 'Advanced') return 'Hard';
    if (maxTechnique === 'Intermediate') return 'Hard';
    return 'Easy'; // Only needed basic singles
  }

  // Not solved by logic → "Very Hard" (needs guessing)
  return 'Very Hard';
}
