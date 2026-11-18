import { generatePuzzle, gridFingerprint, maskFingerprint } from './generator';

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent) => {
  const { amount, difficulty } = e.data as {
    amount: number;
    difficulty: 'Hard' | 'Very Hard';
  };

  const results: any[] = [];
  const fingerprints = new Set<string>();

  for (let i = 0; i < amount; i++) {
    let result = null;
    let retries = 0;
    const MAX_RETRIES = 5;
    while (!result && retries < MAX_RETRIES) {
      result = generatePuzzle(difficulty, fingerprints, i + retries);
      retries++;
    }

    if (result) {
      fingerprints.add(gridFingerprint(result.puzzle));
      fingerprints.add(maskFingerprint(result.puzzle));
      results.push({
        puzzle: result.puzzle,
        solution: result.solution,
        difficulty
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
