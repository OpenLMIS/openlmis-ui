import { describe, expect, it } from 'vitest';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import { settleFew } from '@/lib/settle-few';

describe('settleFew', () => {
  it('stops queued tasks when a task reports that its session ended', async () => {
    const sent: number[] = [];
    const ended = new SessionEndedError();
    const result = settleFew([1, 2, 3, 4, 5, 6, 7], async (item) => {
      sent.push(item);
      throw ended;
    });

    await expect(result).rejects.toBe(ended);
    expect(sent).toEqual([1, 2, 3, 4, 5]);
  });

  it('stops queued tasks when scope changes even if the task returns an ordinary failure', async () => {
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'ada',
      username: 'ada',
      accessToken: 'ada-token',
    });
    const sent: number[] = [];
    const result = settleFew([1, 2, 3, 4, 5, 6, 7], async (item) => {
      sent.push(item);
      useLoginData.getState().clearLoginData();
      throw new Error('network failure');
    });

    await expect(result).rejects.toBeInstanceOf(SessionEndedError);
    expect(sent).toEqual([1]);
  });

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
