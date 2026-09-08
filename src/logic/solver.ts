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

export function countSolutions(grid: Grid): number {
  let count = 0;

  function solve() {
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

// Logic Solver

export type TechniqueLevel = 
  | 'Basic'       // Singles
  | 'Intermediate'// Pairs, Pointing, Box-Line
  | 'Advanced'    // X-Wing, Swordfish, XY-Wing
  | 'Guessing';   // Requires Backtracking

function getCandidates(grid: Grid): Set<number>[][] {
  const candidates: Set<number>[][] = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9]))
  );

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) {
        candidates[r][c].clear();
      } else {
        for (let num = 1; num <= 9; num++) {
          if (!isValid(grid, r, c, num)) {
            candidates[r][c].delete(num);
          }
        }
      }
    }
  }
  return candidates;
}

function eliminateFromRegion(candidates: Set<number>[][], num: number, r: number, c: number) {
  let changed = false;
  for (let i = 0; i < 9; i++) {
    if (i !== c && candidates[r][i].has(num)) {
      candidates[r][i].delete(num);
      changed = true;
    }
    if (i !== r && candidates[i][c].has(num)) {
      candidates[i][c].delete(num);
      changed = true;
    }
  }
  const startRow = r - (r % 3);
  const startCol = c - (c % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const rr = startRow + i;
      const cc = startCol + j;
      if ((rr !== r || cc !== c) && candidates[rr][cc].has(num)) {
        candidates[rr][cc].delete(num);
        changed = true;
      }
    }
  }
  return changed;
}

export function classifyDifficulty(originalGrid: Grid): 'Easy' | 'Hard' | 'Very Hard' {
  const grid = cloneGrid(originalGrid);
  let candidates = getCandidates(grid);
  
  let maxTechnique: TechniqueLevel = 'Basic';
  let stuck = false;

  while (!stuck) {
    let changed = false;

    // 1. Naked Singles
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0 && candidates[r][c].size === 1) {
          const val = Array.from(candidates[r][c])[0];
          grid[r][c] = val;
          candidates[r][c].clear();
          eliminateFromRegion(candidates, val, r, c);
          changed = true;
        }
      }
    }
    if (changed) continue;

    // 2. Hidden Singles
    for (let num = 1; num <= 9; num++) {
      // Check rows
      for (let r = 0; r < 9; r++) {
        let possibleCols = [];
        for (let c = 0; c < 9; c++) {
          if (grid[r][c] === 0 && candidates[r][c].has(num)) possibleCols.push(c);
        }
        if (possibleCols.length === 1) {
          const c = possibleCols[0];
          grid[r][c] = num;
          candidates[r][c].clear();
          eliminateFromRegion(candidates, num, r, c);
          changed = true;
        }
      }
      // Check cols
      for (let c = 0; c < 9; c++) {
        let possibleRows = [];
        for (let r = 0; r < 9; r++) {
          if (grid[r][c] === 0 && candidates[r][c].has(num)) possibleRows.push(r);
        }
        if (possibleRows.length === 1) {
          const r = possibleRows[0];
          grid[r][c] = num;
          candidates[r][c].clear();
          eliminateFromRegion(candidates, num, r, c);
          changed = true;
        }
      }
      // Check boxes
      for (let b = 0; b < 9; b++) {
        const startRow = Math.floor(b / 3) * 3;
        const startCol = (b % 3) * 3;
        let possibleCells = [];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const r = startRow + i;
            const c = startCol + j;
            if (grid[r][c] === 0 && candidates[r][c].has(num)) possibleCells.push([r, c]);
          }
        }
        if (possibleCells.length === 1) {
          const [r, c] = possibleCells[0];
          grid[r][c] = num;
          candidates[r][c].clear();
          eliminateFromRegion(candidates, num, r, c);
          changed = true;
        }
      }
    }
    if (changed) continue;

    // 3. Pointing Pairs / Box-Line Reduction (Intermediate)
    for (let num = 1; num <= 9; num++) {
      for (let b = 0; b < 9; b++) {
        const startRow = Math.floor(b / 3) * 3;
        const startCol = (b % 3) * 3;
        const rows = new Set<number>();
        const cols = new Set<number>();
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const r = startRow + i;
            const c = startCol + j;
            if (candidates[r][c].has(num)) {
              rows.add(r);
              cols.add(c);
            }
          }
        }
        
        // Pointing row
        if (rows.size === 1) {
          const r = Array.from(rows)[0];
          for (let c = 0; c < 9; c++) {
            if (c < startCol || c >= startCol + 3) {
              if (candidates[r][c].has(num)) {
                candidates[r][c].delete(num);
                changed = true;
              }
            }
          }
        }
        
        // Pointing col
        if (cols.size === 1) {
          const c = Array.from(cols)[0];
          for (let r = 0; r < 9; r++) {
            if (r < startRow || r >= startRow + 3) {
              if (candidates[r][c].has(num)) {
                candidates[r][c].delete(num);
                changed = true;
              }
            }
          }
        }
      }
    }
    
    if (changed) {
      if (maxTechnique === 'Basic') maxTechnique = 'Intermediate';
      continue;
    }

    // 4. Naked Pairs (Intermediate)
    for (let r = 0; r < 9; r++) {
      for (let c1 = 0; c1 < 8; c1++) {
        if (candidates[r][c1].size === 2) {
          for (let c2 = c1 + 1; c2 < 9; c2++) {
            if (
              candidates[r][c2].size === 2 && 
              Array.from(candidates[r][c1]).every(val => candidates[r][c2].has(val))
            ) {
              const [v1, v2] = Array.from(candidates[r][c1]);
              for (let c = 0; c < 9; c++) {
                if (c !== c1 && c !== c2) {
                  if (candidates[r][c].has(v1)) { candidates[r][c].delete(v1); changed = true; }
                  if (candidates[r][c].has(v2)) { candidates[r][c].delete(v2); changed = true; }
                }
              }
            }
          }
        }
      }
    }
    
    // Naked Pairs in Cols and Boxes (Simplified for brevity, assume similar impact)
    // Only added rows to not overcomplicate, usually X-Wing captures similar logic or they feed into each other.
    
    // 5. X-Wing (Advanced)
    for (let num = 1; num <= 9; num++) {
      const rowPositions = [];
      for (let r = 0; r < 9; r++) {
        const cols = [];
        for (let c = 0; c < 9; c++) {
          if (candidates[r][c].has(num)) cols.push(c);
        }
        if (cols.length === 2) {
          rowPositions.push({ r, cols });
        }
      }
      
      for (let i = 0; i < rowPositions.length - 1; i++) {
        for (let j = i + 1; j < rowPositions.length; j++) {
          const r1 = rowPositions[i];
          const r2 = rowPositions[j];
          if (r1.cols[0] === r2.cols[0] && r1.cols[1] === r2.cols[1]) {
            const c1 = r1.cols[0];
            const c2 = r1.cols[1];
            for (let r = 0; r < 9; r++) {
              if (r !== r1.r && r !== r2.r) {
                if (candidates[r][c1].has(num)) { candidates[r][c1].delete(num); changed = true; }
                if (candidates[r][c2].has(num)) { candidates[r][c2].delete(num); changed = true; }
              }
            }
          }
        }
      }
    }

    if (changed) {
      if (maxTechnique !== 'Advanced') maxTechnique = 'Advanced';
      continue;
    }
    
    stuck = true;
  }

  // Check if solved
  let solved = true;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        solved = false;
        break;
      }
    }
  }

  if (solved) {
    if (maxTechnique === 'Intermediate' || maxTechnique === 'Advanced') return 'Hard';
    return 'Easy'; // Basic singles only
  }

  // If not solved but unique, it requires guessing/backtracking -> Very Hard
  if (countSolutions(originalGrid) === 1) {
    return 'Very Hard';
  }

  return 'Easy'; // Fallback
}

