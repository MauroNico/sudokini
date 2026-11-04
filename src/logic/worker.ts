import { generatePuzzle, gridFingerprint } from './generator';

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent) => {
  const { amount, difficulty } = e.data;

  const results: any[] = [];
  const fingerprints = new Set<string>();

  for (let i = 0; i < amount; i++) {
    // If mixed, alternate difficulty
    let currentDifficulty: 'Hard' | 'Very Hard' = difficulty;
    if (difficulty === 'Mixed') {
      currentDifficulty = i % 2 === 0 ? 'Hard' : 'Very Hard';
    }

    let result = null;
    let retries = 0;
    const MAX_RETRIES = 5;
    while (!result && retries < MAX_RETRIES) {
      result = generatePuzzle(currentDifficulty, fingerprints);
      retries++;
    }

    if (result) {
      fingerprints.add(gridFingerprint(result.puzzle));
      results.push({
        puzzle: result.puzzle,
        solution: result.solution,
        difficulty: currentDifficulty
      });
    }

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
