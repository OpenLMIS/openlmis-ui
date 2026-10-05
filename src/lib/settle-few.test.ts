import { describe, expect, it } from 'vitest';
import { settleFew } from '@/lib/settle-few';

describe('settleFew', () => {
  it('returns what each finished task gave, the items that failed and the first error', async () => {
    const result = await settleFew([1, 2, 3, 4], async (n) => {
      if (n % 2 === 0) throw new Error(`no ${n}`);
      return n * 10;
    });

    expect(result.done).toEqual([10, 30]);
    expect(result.failed).toEqual([2, 4]);
    expect(result.error).toEqual(new Error('no 2'));
  });

  it('never runs more than five at once', async () => {
    let running = 0;
    let most = 0;
    await settleFew(
      Array.from({ length: 12 }, (_, i) => i),
      async () => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        running -= 1;
      },
    );

    expect(most).toBe(5);
  });
});
