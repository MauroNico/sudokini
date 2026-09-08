import { generatePuzzle } from './generator';

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent) => {
  const { amount, difficulty } = e.data;

  const results: any[] = [];

  for (let i = 0; i < amount; i++) {
    // If mixed, alternate difficulty
    let currentDifficulty = difficulty;
    if (difficulty === 'Mixed') {
      currentDifficulty = i % 2 === 0 ? 'Hard' : 'Very Hard';
    }

    let result = null;
    while (!result) {
      result = generatePuzzle(currentDifficulty);
    }
    
    results.push({
      puzzle: result.puzzle,
      solution: result.solution,
      difficulty: currentDifficulty
    });

    ctx.postMessage({
      type: 'progress',
      current: i + 1,
      total: amount
    });
  }

  ctx.postMessage({
    type: 'done',
    results
  });
};

