import { describe, expect, it } from '@jest/globals';

import { OperationQueue } from '@/services/operation-queue';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('OperationQueue', () => {
  it('runs operations one after another, never overlapping', async () => {
    const queue = new OperationQueue();
    const log: string[] = [];
    const op = (name: string) => async () => {
      log.push(`${name} start`);
      await tick(); // give a second operation the chance to sneak in
      log.push(`${name} end`);
    };

    await Promise.all([queue.run(op('a')), queue.run(op('b')), queue.run(op('c'))]);

    expect(log).toEqual(['a start', 'a end', 'b start', 'b end', 'c start', 'c end']);
  });

  it('a failed operation does not block the ones after it', async () => {
    const queue = new OperationQueue();
    const failing = queue.run(async () => {
      throw new Error('boom');
    });
    const next = queue.run(async () => 'still runs');

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('still runs');
  });

  it('returns each operation’s own result', async () => {
    const queue = new OperationQueue();
    expect(await Promise.all([queue.run(async () => 1), queue.run(async () => 2)])).toEqual([1, 2]);
  });
});
