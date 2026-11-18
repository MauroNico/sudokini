import jsPDF from 'jspdf';
import { Grid } from '../logic/solver';

type PuzzleData = {
  puzzle: Grid;
  solution: Grid;
  difficulty: string;
};

const DIFFICULTY_LABELS: Record<'Hard' | 'Very Hard', { label: string; slug: string }> = {
  Hard: { label: 'Difícil', slug: 'dificil' },
  'Very Hard': { label: 'Muy Difícil', slug: 'muy-dificil' }
};

const LAYOUTS = {
  4: {
    sudokuSize: 85.5,
    cellSize: 9.5,
    columns: 2,
    rows: 2,
    startX: [14, 110.5],
    startY: [38, 158],
    fontSize: 18
  },
  6: {
    sudokuSize: 76.5,
    cellSize: 8.5,
    columns: 2,
    rows: 3,
    startX: [20, 113.5],
    startY: [22, 115, 208],
    fontSize: 16
  }
} as const;

export function generatePDF(
  data: PuzzleData[],
  includeSolutions: boolean,
  globalDifficulty: 'Hard' | 'Very Hard',
  perPage: 4 | 6 = 6
) {
  const { label: diffLabel, slug: diffSlug } = DIFFICULTY_LABELS[globalDifficulty];

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const SIZES = LAYOUTS[perPage];

  let pageNum = 1;
  const dateStr = new Date().toLocaleDateString();

  function drawPageHeaderFooter(isSolution: boolean) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const headerText = isSolution
      ? `Soluciones - Página ${pageNum}`
      : `Sudokus (${diffLabel}) - Página ${pageNum}`;
    doc.text(headerText, 105, 12, { align: 'center' });

    doc.setFontSize(8);
    const footerText = `Página ${pageNum} - Generado el ${dateStr}`;
    doc.text(footerText, 105, 290, { align: 'center' });
  }

  function drawSudokuGrid(x: number, y: number, grid: Grid, puzzleNum: number) {
    // Title
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Sudoku #${puzzleNum}`, x + SIZES.sudokuSize / 2, y - 3, { align: 'center' });

    // Draw cells
    doc.setFontSize(SIZES.fontSize);
    doc.setFont('helvetica', 'normal');
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = grid[r][c];
        if (val !== 0) {
          doc.text(
            val.toString(),
            x + c * SIZES.cellSize + SIZES.cellSize / 2,
            y + r * SIZES.cellSize + SIZES.cellSize / 2 + 1.5, // +1.5 to vertically center text
            { align: 'center', baseline: 'middle' }
          );
        }
      }
    }

    // Draw lines
    for (let i = 0; i <= 9; i++) {
      const isMajor = i % 3 === 0;
      doc.setLineWidth(isMajor ? 0.6 : 0.15);
      
      // Horizontal
      doc.line(x, y + i * SIZES.cellSize, x + SIZES.sudokuSize, y + i * SIZES.cellSize);
      // Vertical
      doc.line(x + i * SIZES.cellSize, y, x + i * SIZES.cellSize, y + SIZES.sudokuSize);
    }
  }

  // Draw Puzzles
  for (let i = 0; i < data.length; i++) {
    if (i % perPage === 0) {
      if (i !== 0) {
        doc.addPage();
        pageNum++;
      }
      drawPageHeaderFooter(false);
    }

    const col = (i % perPage) % SIZES.columns;
    const row = Math.floor((i % perPage) / SIZES.columns);

    drawSudokuGrid(SIZES.startX[col], SIZES.startY[row], data[i].puzzle, i + 1);
  }

  // Draw Solutions
  if (includeSolutions) {
    doc.addPage();
    pageNum++;
    for (let i = 0; i < data.length; i++) {
      if (i % perPage === 0) {
        if (i !== 0) {
          doc.addPage();
          pageNum++;
        }
        drawPageHeaderFooter(true);
      }

      const col = (i % perPage) % SIZES.columns;
      const row = Math.floor((i % perPage) / SIZES.columns);

      drawSudokuGrid(SIZES.startX[col], SIZES.startY[row], data[i].solution, i + 1);
    }
  }

  doc.save(`sudokus-${diffSlug}-${data.length}.pdf`);
}

