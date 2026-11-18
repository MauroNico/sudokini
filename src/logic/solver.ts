export type Grid = number[][];

export function cloneGrid(grid: Grid): Grid {
  return grid.map(row => [...row]);
}

export function isValid(grid: Grid, row: number, col: number, num: number): boolean {
  for (let x = 0; x < 9; x++) {
    if (grid[row][x] === num) return false;
    if (grid[x][col] === num) return false;
  }
  const startRow = row - (row % 3);
  const startCol = col - (col % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (grid[i + startRow][j + startCol] === num) return false;
    }
  }
  return true;
}

// ========== BITMASK MRV BACKTRACKING SOLVER ==========

const ALL_DIGITS_MASK = 0x3fe; // bits 1..9

const POPCOUNT = (() => {
  const table = new Uint8Array(1024);
  for (let i = 1; i < 1024; i++) {
    table[i] = table[i >> 1] + (i & 1);
  }
  return table;
})();

const BOX_INDEX = (() => {
  const table = new Uint8Array(81);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      table[r * 9 + c] = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    }
  }
  return table;
})();

interface BitSolverState {
  cells: Uint8Array;
  rowMask: Uint16Array;
  colMask: Uint16Array;
  boxMask: Uint16Array;
}

function initBitState(originalGrid: Grid): BitSolverState | null {
  const cells = new Uint8Array(81);
  const rowMask = new Uint16Array(9);
  const colMask = new Uint16Array(9);
  const boxMask = new Uint16Array(9);

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = originalGrid[r][c];
      if (val === 0) continue;
      if (val < 1 || val > 9) return null;

      const bit = 1 << val;
      const box = BOX_INDEX[r * 9 + c];
      if ((rowMask[r] & bit) || (colMask[c] & bit) || (boxMask[box] & bit)) {
        return null;
      }
      cells[r * 9 + c] = val;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[box] |= bit;
    }
  }

  return { cells, rowMask, colMask, boxMask };
}

function findMrvCell(state: BitSolverState): { idx: number; mask: number } | null {
  const { cells, rowMask, colMask, boxMask } = state;
  let bestIdx = -1;
  let bestCount = 10;
  let bestMask = 0;

  for (let idx = 0; idx < 81; idx++) {
    if (cells[idx] !== 0) continue;
    const r = (idx / 9) | 0;
    const c = idx % 9;
    const box = BOX_INDEX[idx];
    const avail = ~(rowMask[r] | colMask[c] | boxMask[box]) & ALL_DIGITS_MASK;
    const cnt = POPCOUNT[avail];
    if (cnt === 0) {
      return { idx, mask: 0 };
    }
    if (cnt < bestCount) {
      bestCount = cnt;
      bestIdx = idx;
      bestMask = avail;
      if (cnt === 1) break;
    }
  }

  if (bestIdx === -1) return null;
  return { idx: bestIdx, mask: bestMask };
}

/**
 * Counts solutions for the given puzzle, stopping early at 2.
 * IMPORTANT: Does NOT mutate the caller's data.
 */
export function countSolutions(originalGrid: Grid): number {
  const state = initBitState(originalGrid);
  if (!state) return 0;

  const { cells, rowMask, colMask, boxMask } = state;
  let count = 0;

  function search(): void {
    if (count >= 2) return;
    const next = findMrvCell(state!);
    if (!next) {
      count++;
      return;
    }
    if (next.mask === 0) return;

    const idx = next.idx;
    const r = (idx / 9) | 0;
    const c = idx % 9;
    const box = BOX_INDEX[idx];
    let avail = next.mask;

    while (avail !== 0) {
      const bit = avail & -avail;
      avail ^= bit;
      const num = 31 - Math.clz32(bit);

      cells[idx] = num;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[box] |= bit;

      search();

      cells[idx] = 0;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[box] &= ~bit;

      if (count >= 2) return;
    }
  }

  search();
  return count;
}

/**
 * Solves the puzzle via MRV backtracking and returns the solved grid,
 * or null if no solution exists. Does NOT mutate the input.
 */
export function solveGrid(originalGrid: Grid): Grid | null {
  const state = initBitState(originalGrid);
  if (!state) return null;

  const { cells, rowMask, colMask, boxMask } = state;

  function search(): boolean {
    const next = findMrvCell(state!);
    if (!next) return true;
    if (next.mask === 0) return false;

    const idx = next.idx;
    const r = (idx / 9) | 0;
    const c = idx % 9;
    const box = BOX_INDEX[idx];
    let avail = next.mask;

    while (avail !== 0) {
      const bit = avail & -avail;
      avail ^= bit;
      const num = 31 - Math.clz32(bit);

      cells[idx] = num;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[box] |= bit;

      if (search()) return true;

      cells[idx] = 0;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[box] &= ~bit;
    }

    return false;
  }

  if (!search()) return null;

  const solved: Grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      solved[r][c] = cells[r * 9 + c];
    }
  }
  return solved;
}

// ========== LOGICAL SOLVER & DIFFICULTY CLASSIFIER ==========

export type TechniqueLevel =
  | 'Basic'        // Naked/Hidden Singles
  | 'Intermediate' // Pointing, Box-Line, Pairs, Triples
  | 'Advanced'     // X-Wing, Swordfish, Skyscraper, 2-String Kite, XY-Wing, XYZ-Wing
  | 'Expert'       // Single-step bi-value contradiction / forcing
  | 'Guessing';    // Unsolvable by logical solver

type CellPos = [number, number];

const ALL_HOUSES: CellPos[][] = (() => {
  const houses: CellPos[][] = [];
  for (let r = 0; r < 9; r++) {
    const row: CellPos[] = [];
    for (let c = 0; c < 9; c++) row.push([r, c]);
    houses.push(row);
  }
  for (let c = 0; c < 9; c++) {
    const col: CellPos[] = [];
    for (let r = 0; r < 9; r++) col.push([r, c]);
    houses.push(col);
  }
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3;
    const bc = (b % 3) * 3;
    const box: CellPos[] = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        box.push([br + i, bc + j]);
      }
    }
    houses.push(box);
  }
  return houses;
})();

function arePeers(r1: number, c1: number, r2: number, c2: number): boolean {
  if (r1 === r2 && c1 === c2) return false;
  if (r1 === r2 || c1 === c2) return true;
  return Math.floor(r1 / 3) === Math.floor(r2 / 3) && Math.floor(c1 / 3) === Math.floor(c2 / 3);
}

function cloneCandidates(cands: Set<number>[][]): Set<number>[][] {
  return cands.map(row => row.map(cell => new Set(cell)));
}

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
  for (let i = 0; i < 9; i++) {
    if (i !== c) candidates[r][i].delete(num);
    if (i !== r) candidates[i][c].delete(num);
  }
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

function hasContradiction(grid: Grid, cands: Set<number>[][]): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0 && cands[r][c].size === 0) {
        return true;
      }
    }
  }

  for (const house of ALL_HOUSES) {
    let placedMask = 0;
    let candMask = 0;
    for (const [r, c] of house) {
      const val = grid[r][c];
      if (val !== 0) {
        const bit = 1 << val;
        if (placedMask & bit) return true;
        placedMask |= bit;
      } else {
        for (const num of cands[r][c]) {
          candMask |= 1 << num;
        }
      }
    }
    if ((placedMask | candMask) !== ALL_DIGITS_MASK) {
      return true;
    }
  }

  return false;
}

// ============ Techniques ============

function nakedSingles(grid: Grid, cands: Set<number>[][]): boolean {
  let found = false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0 && cands[r][c].size === 1) {
        const val = cands[r][c].values().next().value!;
        if (isValid(grid, r, c, val)) {
          grid[r][c] = val;
          cands[r][c].clear();
          eliminateFromPeers(cands, val, r, c);
          found = true;
        }
      }
    }
  }
  return found;
}

function hiddenSingles(grid: Grid, cands: Set<number>[][]): boolean {
  let found = false;

  for (const cells of ALL_HOUSES) {
    for (let num = 1; num <= 9; num++) {
      const spots: CellPos[] = [];
      for (const [r, c] of cells) {
        if (cands[r][c].has(num)) spots.push([r, c]);
      }
      if (spots.length === 1) {
        const [r, c] = spots[0];
        if (grid[r][c] === 0 && isValid(grid, r, c, num)) {
          grid[r][c] = num;
          cands[r][c].clear();
          eliminateFromPeers(cands, num, r, c);
          found = true;
        }
      }
    }
  }

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

      if (rows.size === 1) {
        const r = rows.values().next().value!;
        for (let c = 0; c < 9; c++) {
          if (c < bc || c >= bc + 3) {
            if (cands[r][c].delete(num)) found = true;
          }
        }
      }

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

  // Box-line reduction
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
            if (rr !== r && cands[rr][cc].delete(num)) {
              found = true;
            }
          }
        }
      }
    }

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
            if (cc !== c && cands[rr][cc].delete(num)) {
              found = true;
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

  for (const house of ALL_HOUSES) {
    const cells = house.filter(([r, c]) => cands[r][c].size > 0);
    for (let a = 0; a < cells.length - 1; a++) {
      const [ra, ca] = cells[a];
      if (cands[ra][ca].size !== 2) continue;
      for (let b2 = a + 1; b2 < cells.length; b2++) {
        const [rb, cb] = cells[b2];
        if (cands[rb][cb].size !== 2) continue;
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

  return found;
}

function hiddenPairs(cands: Set<number>[][]): boolean {
  let found = false;

  for (const house of ALL_HOUSES) {
    const positionsByNum = new Map<number, number[]>();
    for (let num = 1; num <= 9; num++) {
      const pos: number[] = [];
      for (let idx = 0; idx < house.length; idx++) {
        const [r, c] = house[idx];
        if (cands[r][c].has(num)) pos.push(idx);
      }
      if (pos.length === 2) positionsByNum.set(num, pos);
    }

    const nums = Array.from(positionsByNum.keys());
    for (let i = 0; i < nums.length - 1; i++) {
      const d1 = nums[i];
      const p1 = positionsByNum.get(d1)!;
      for (let j = i + 1; j < nums.length; j++) {
        const d2 = nums[j];
        const p2 = positionsByNum.get(d2)!;
        if (p1[0] === p2[0] && p1[1] === p2[1]) {
          for (const idx of p1) {
            const [r, c] = house[idx];
            for (const val of Array.from(cands[r][c])) {
              if (val !== d1 && val !== d2) {
                cands[r][c].delete(val);
                found = true;
              }
            }
          }
        }
      }
    }
  }

  return found;
}

function nakedTriples(cands: Set<number>[][]): boolean {
  let found = false;

  for (const house of ALL_HOUSES) {
    const cells = house.filter(([r, c]) => cands[r][c].size > 0);
    const eligible = cells.filter(([r, c]) => cands[r][c].size >= 2 && cands[r][c].size <= 3);
    if (eligible.length < 3) continue;

    for (let a = 0; a < eligible.length - 2; a++) {
      for (let b2 = a + 1; b2 < eligible.length - 1; b2++) {
        for (let c2 = b2 + 1; c2 < eligible.length; c2++) {
          const union = new Set<number>();
          for (const v of cands[eligible[a][0]][eligible[a][1]]) union.add(v);
          for (const v of cands[eligible[b2][0]][eligible[b2][1]]) union.add(v);
          for (const v of cands[eligible[c2][0]][eligible[c2][1]]) union.add(v);
          if (union.size !== 3) continue;

          for (const [rx, cx] of cells) {
            if (
              (rx === eligible[a][0] && cx === eligible[a][1]) ||
              (rx === eligible[b2][0] && cx === eligible[b2][1]) ||
              (rx === eligible[c2][0] && cx === eligible[c2][1])
            ) {
              continue;
            }
            for (const v of union) {
              if (cands[rx][cx].delete(v)) found = true;
            }
          }
        }
      }
    }
  }

  return found;
}

function hiddenTriples(cands: Set<number>[][]): boolean {
  let found = false;

  for (const house of ALL_HOUSES) {
    const eligible: { num: number; pos: number[] }[] = [];
    for (let num = 1; num <= 9; num++) {
      const pos: number[] = [];
      for (let idx = 0; idx < house.length; idx++) {
        const [r, c] = house[idx];
        if (cands[r][c].has(num)) pos.push(idx);
      }
      if (pos.length >= 2 && pos.length <= 3) {
        eligible.push({ num, pos });
      }
    }
    if (eligible.length < 3) continue;

    for (let a = 0; a < eligible.length - 2; a++) {
      for (let b2 = a + 1; b2 < eligible.length - 1; b2++) {
        for (let c2 = b2 + 1; c2 < eligible.length; c2++) {
          const cellUnion = new Set<number>([
            ...eligible[a].pos,
            ...eligible[b2].pos,
            ...eligible[c2].pos
          ]);
          if (cellUnion.size !== 3) continue;

          const keep = new Set([eligible[a].num, eligible[b2].num, eligible[c2].num]);
          for (const idx of cellUnion) {
            const [r, c] = house[idx];
            for (const val of Array.from(cands[r][c])) {
              if (!keep.has(val)) {
                cands[r][c].delete(val);
                found = true;
              }
            }
          }
        }
      }
    }
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
          const colUnion = new Set<number>([
            ...rowInfo[a].cols,
            ...rowInfo[b2].cols,
            ...rowInfo[c2].cols
          ]);
          if (colUnion.size !== 3) continue;

          const usedRows = new Set([rowInfo[a].r, rowInfo[b2].r, rowInfo[c2].r]);
          for (const col of colUnion) {
            for (let r = 0; r < 9; r++) {
              if (!usedRows.has(r) && cands[r][col].delete(num)) {
                found = true;
              }
            }
          }
        }
      }
    }

    // Column-based Swordfish
    const colInfo: { c: number; rows: number[] }[] = [];
    for (let c = 0; c < 9; c++) {
      const rows: number[] = [];
      for (let r = 0; r < 9; r++) {
        if (cands[r][c].has(num)) rows.push(r);
      }
      if (rows.length >= 2 && rows.length <= 3) colInfo.push({ c, rows });
    }

    for (let a = 0; a < colInfo.length - 2; a++) {
      for (let b2 = a + 1; b2 < colInfo.length - 1; b2++) {
        for (let c2 = b2 + 1; c2 < colInfo.length; c2++) {
          const rowUnion = new Set<number>([
            ...colInfo[a].rows,
            ...colInfo[b2].rows,
            ...colInfo[c2].rows
          ]);
          if (rowUnion.size !== 3) continue;

          const usedCols = new Set([colInfo[a].c, colInfo[b2].c, colInfo[c2].c]);
          for (const row of rowUnion) {
            for (let c = 0; c < 9; c++) {
              if (!usedCols.has(c) && cands[row][c].delete(num)) {
                found = true;
              }
            }
          }
        }
      }
    }
  }

  return found;
}

function skyscraper(cands: Set<number>[][]): boolean {
  let found = false;

  for (let num = 1; num <= 9; num++) {
    // Row-based Skyscraper
    const rowPairs: { r: number; cols: [number, number] }[] = [];
    for (let r = 0; r < 9; r++) {
      const cols: number[] = [];
      for (let c = 0; c < 9; c++) {
        if (cands[r][c].has(num)) cols.push(c);
      }
      if (cols.length === 2) rowPairs.push({ r, cols: [cols[0], cols[1]] });
    }

    for (let i = 0; i < rowPairs.length - 1; i++) {
      for (let j = i + 1; j < rowPairs.length; j++) {
        const a = rowPairs[i];
        const b = rowPairs[j];
        let roofACol = -1;
        let roofBCol = -1;

        if (a.cols[0] === b.cols[0] && a.cols[1] !== b.cols[1]) {
          roofACol = a.cols[1];
          roofBCol = b.cols[1];
        } else if (a.cols[0] === b.cols[1] && a.cols[1] !== b.cols[0]) {
          roofACol = a.cols[1];
          roofBCol = b.cols[0];
        } else if (a.cols[1] === b.cols[0] && a.cols[0] !== b.cols[1]) {
          roofACol = a.cols[0];
          roofBCol = b.cols[1];
        } else if (a.cols[1] === b.cols[1] && a.cols[0] !== b.cols[0]) {
          roofACol = a.cols[0];
          roofBCol = b.cols[0];
        }

        if (roofACol !== -1) {
          for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
              if (arePeers(r, c, a.r, roofACol) && arePeers(r, c, b.r, roofBCol)) {
                if (cands[r][c].delete(num)) found = true;
              }
            }
          }
        }
      }
    }

    // Column-based Skyscraper
    const colPairs: { c: number; rows: [number, number] }[] = [];
    for (let c = 0; c < 9; c++) {
      const rows: number[] = [];
      for (let r = 0; r < 9; r++) {
        if (cands[r][c].has(num)) rows.push(r);
      }
      if (rows.length === 2) colPairs.push({ c, rows: [rows[0], rows[1]] });
    }

    for (let i = 0; i < colPairs.length - 1; i++) {
      for (let j = i + 1; j < colPairs.length; j++) {
        const a = colPairs[i];
        const b = colPairs[j];
        let roofARow = -1;
        let roofBRow = -1;

        if (a.rows[0] === b.rows[0] && a.rows[1] !== b.rows[1]) {
          roofARow = a.rows[1];
          roofBRow = b.rows[1];
        } else if (a.rows[0] === b.rows[1] && a.rows[1] !== b.rows[0]) {
          roofARow = a.rows[1];
          roofBRow = b.rows[0];
        } else if (a.rows[1] === b.rows[0] && a.rows[0] !== b.rows[1]) {
          roofARow = a.rows[0];
          roofBRow = b.rows[1];
        } else if (a.rows[1] === b.rows[1] && a.rows[0] !== b.rows[0]) {
          roofARow = a.rows[0];
          roofBRow = b.rows[0];
        }

        if (roofARow !== -1) {
          for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
              if (arePeers(r, c, roofARow, a.c) && arePeers(r, c, roofBRow, b.c)) {
                if (cands[r][c].delete(num)) found = true;
              }
            }
          }
        }
      }
    }
  }

  return found;
}

function twoStringKite(cands: Set<number>[][]): boolean {
  let found = false;

  for (let num = 1; num <= 9; num++) {
    const rowPairs: [CellPos, CellPos][] = [];
    for (let r = 0; r < 9; r++) {
      const cells: CellPos[] = [];
      for (let c = 0; c < 9; c++) {
        if (cands[r][c].has(num)) cells.push([r, c]);
      }
      if (cells.length === 2) rowPairs.push([cells[0], cells[1]]);
    }

    const colPairs: [CellPos, CellPos][] = [];
    for (let c = 0; c < 9; c++) {
      const cells: CellPos[] = [];
      for (let r = 0; r < 9; r++) {
        if (cands[r][c].has(num)) cells.push([r, c]);
      }
      if (cells.length === 2) colPairs.push([cells[0], cells[1]]);
    }

    for (const [ra, rb] of rowPairs) {
      for (const [ca, cb] of colPairs) {
        const orientations: [CellPos, CellPos, CellPos, CellPos][] = [
          [ra, rb, ca, cb],
          [ra, rb, cb, ca],
          [rb, ra, ca, cb],
          [rb, ra, cb, ca]
        ];

        for (const [rowLink, rowEnd, colLink, colEnd] of orientations) {
          if (rowLink[0] === colLink[0] && rowLink[1] === colLink[1]) continue;
          if (rowEnd[0] === colEnd[0] && rowEnd[1] === colEnd[1]) continue;

          const sameBox =
            BOX_INDEX[rowLink[0] * 9 + rowLink[1]] === BOX_INDEX[colLink[0] * 9 + colLink[1]];
          if (!sameBox) continue;

          for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
              if ((r === rowEnd[0] && c === rowEnd[1]) || (r === colEnd[0] && c === colEnd[1])) {
                continue;
              }
              if (arePeers(r, c, rowEnd[0], rowEnd[1]) && arePeers(r, c, colEnd[0], colEnd[1])) {
                if (cands[r][c].delete(num)) found = true;
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

  const biCells: CellPos[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (cands[r][c].size === 2) biCells.push([r, c]);
    }
  }

  for (const [pr, pc] of biCells) {
    const [x, y] = Array.from(cands[pr][pc]);
    const wingsX: [number, number, number][] = [];
    const wingsY: [number, number, number][] = [];

    for (const [wr, wc] of biCells) {
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

    for (const [w1r, w1c, z1] of wingsX) {
      for (const [w2r, w2c, z2] of wingsY) {
        if (z1 !== z2) continue;
        const z = z1;
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
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

function xyzWing(cands: Set<number>[][]): boolean {
  let found = false;

  const biCells: CellPos[] = [];
  const triCells: CellPos[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (cands[r][c].size === 2) biCells.push([r, c]);
      else if (cands[r][c].size === 3) triCells.push([r, c]);
    }
  }

  for (const [pr, pc] of triCells) {
    const pSet = cands[pr][pc];
    const wings: { r: number; c: number; vals: [number, number] }[] = [];

    for (const [wr, wc] of biCells) {
      if (!arePeers(pr, pc, wr, wc)) continue;
      const wVals = Array.from(cands[wr][wc]);
      if (pSet.has(wVals[0]) && pSet.has(wVals[1])) {
        wings.push({ r: wr, c: wc, vals: [wVals[0], wVals[1]] });
      }
    }

    for (let i = 0; i < wings.length - 1; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        const w1 = wings[i];
        const w2 = wings[j];

        const shared = w1.vals.filter(v => w2.vals.includes(v));
        if (shared.length !== 1) continue;

        const z = shared[0];
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (
              arePeers(r, c, pr, pc) &&
              arePeers(r, c, w1.r, w1.c) &&
              arePeers(r, c, w2.r, w2.c)
            ) {
              if (cands[r][c].delete(z)) found = true;
            }
          }
        }
      }
    }
  }

  return found;
}

function propagatesToContradiction(
  grid: Grid,
  cands: Set<number>[][],
  r: number,
  c: number,
  val: number
): boolean {
  const testGrid = cloneGrid(grid);
  const testCands = cloneCandidates(cands);

  if (!isValid(testGrid, r, c, val)) return true;
  testGrid[r][c] = val;
  testCands[r][c].clear();
  eliminateFromPeers(testCands, val, r, c);

  if (hasContradiction(testGrid, testCands)) return true;

  for (let step = 0; step < 81; step++) {
    let progressed = false;
    if (nakedSingles(testGrid, testCands)) progressed = true;
    else if (hiddenSingles(testGrid, testCands)) progressed = true;
    else if (pointingPairs(testCands)) progressed = true;

    if (hasContradiction(testGrid, testCands)) return true;
    if (!progressed) break;
  }

  return false;
}

function bivalueContradiction(grid: Grid, cands: Set<number>[][]): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0 && cands[r][c].size === 2) {
        const [v1, v2] = Array.from(cands[r][c]);
        if (propagatesToContradiction(grid, cands, r, c, v1)) {
          cands[r][c].delete(v1);
          return true;
        }
        if (propagatesToContradiction(grid, cands, r, c, v2)) {
          cands[r][c].delete(v2);
          return true;
        }
      }
    }
  }
  return false;
}

function isGridSolvedAndValid(grid: Grid): boolean {
  for (const house of ALL_HOUSES) {
    let mask = 0;
    for (const [r, c] of house) {
      const val = grid[r][c];
      if (val < 1 || val > 9) return false;
      mask |= 1 << val;
    }
    if (mask !== ALL_DIGITS_MASK) return false;
  }
  return true;
}

// ============ Main classifier ============

export function classifyDifficulty(
  originalGrid: Grid
): 'Easy' | 'Hard' | 'Very Hard' | 'Unsolvable' {
  if (!initBitState(originalGrid)) return 'Unsolvable';

  let clues = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (originalGrid[r][c] !== 0) clues++;
    }
  }

  const grid = cloneGrid(originalGrid);
  const cands = getCandidates(grid);
  if (hasContradiction(grid, cands)) return 'Unsolvable';

  let intermediateCount = 0;
  let subsetCount = 0;
  let advancedCount = 0;
  let expertCount = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // --- Basic ---
    if (nakedSingles(grid, cands)) {
      if (hasContradiction(grid, cands)) return 'Unsolvable';
      continue;
    }
    if (hiddenSingles(grid, cands)) {
      if (hasContradiction(grid, cands)) return 'Unsolvable';
      continue;
    }

    // --- Intermediate ---
    if (pointingPairs(cands)) { intermediateCount++; continue; }
    if (nakedPairs(cands))    { subsetCount++; continue; }
    if (hiddenPairs(cands))   { subsetCount++; continue; }
    if (nakedTriples(cands))  { subsetCount++; continue; }
    if (hiddenTriples(cands)) { subsetCount++; continue; }

    // --- Advanced ---
    if (xWing(cands))         { advancedCount++; continue; }
    if (swordfish(cands))     { advancedCount++; continue; }
    if (skyscraper(cands))    { advancedCount++; continue; }
    if (twoStringKite(cands)) { advancedCount++; continue; }
    if (xyWing(cands))        { advancedCount++; continue; }
    if (xyzWing(cands))       { advancedCount++; continue; }

    // --- Expert ---
    if (bivalueContradiction(grid, cands)) { expertCount++; continue; }

    break;
  }

  if (!isGridSolvedAndValid(grid)) {
    return 'Unsolvable';
  }

  if (
    expertCount > 0 ||
    advancedCount >= 2 ||
    (advancedCount === 1 && (subsetCount >= 1 || intermediateCount >= 2 || clues <= 25))
  ) {
    return 'Very Hard';
  }

  if (
    advancedCount === 1 ||
    subsetCount >= 1 ||
    (intermediateCount >= 2 && clues <= 28)
  ) {
    return 'Hard';
  }

  return 'Easy';
}
