import { vi, describe, test, expect } from "vitest";
import { nevermore } from "../../src";
import { gen2array } from "../testutil";

/** Generator for a series of timeout promises. Pass a callback to be notified of
 * when the count of pending async operations changes (launched but not yet completed).
 */
function* timeoutSequence(
  amount: number,
  delay = 1,
  notifyPending: ((count: number) => void) | null = null
) {
  let pendingCount = 0;
  notifyPending?.(pendingCount);

  let count = 0;

  while (count < amount) {
    const pos = count;
    const fn = async () =>
      await new Promise<number>((resolve) => {
        notifyPending?.(++pendingCount);
        const cb = () => {
          resolve(pos);
          notifyPending?.(--pendingCount);
        };
        if (delay === 0) {
          setImmediate(cb);
        } else {
          setTimeout(cb, delay);
        }
      });
    fn.requestId = `foo${pos}`;
    yield fn;
    count++;
  }
}

describe("Nevermore with concurrency", () => {
  test("concurrency<1 throws an error", async () => {
    await expect(async () => {
      await gen2array(nevermore({ concurrency: -1 }, []));
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      '"Concurrency cannot be less than 1 : {\\"concurrency\\":-1}"'
    );
  });

  test("concurrency===1 forces resolution in series", async () => {
    const notifyPending = vi.fn();
    const promiseSequence = timeoutSequence(5, 10, notifyPending);

    // create schedule
    const settlementSequence = nevermore({ concurrency: 1 }, promiseSequence);

    // run schedule
    const startMs = Date.now();
    const settlements = await gen2array(settlementSequence);
    const durationMs = Date.now() - startMs;

    // check 10 ms jobs didn't run in parallel
    expect(settlements).toMatchObject([
      { kind: "resolved", job: expect.any(Function), value: 0 },
      { kind: "resolved", job: expect.any(Function), value: 1 },
      { kind: "resolved", job: expect.any(Function), value: 2 },
      { kind: "resolved", job: expect.any(Function), value: 3 },
      { kind: "resolved", job: expect.any(Function), value: 4 },
    ]);
    expect(durationMs).toBeGreaterThan(20);
    expect(notifyPending.mock.calls).toEqual([
      [0],
      [1],
      [0],
      [1],
      [0],
      [1],
      [0],
      [1],
      [0],
      [1],
      [0],
    ]);
  });
});
