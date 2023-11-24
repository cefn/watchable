/** Placeholder for a strategy that only allows jobs if there is a remaining slot in the current interval.
 * The interval is a moving window, and slots become available when historical job invocations become old enough
 */

import type {
  RateOptions,
  Job,
  LaunchesGenerator,
  Pipe,
  Strategy,
  StrategyFactory,
} from "../types";

// eslint-disable-next-line @typescript-eslint/promise-function-async
function sleep(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function createRateStrategy<T, J extends Job<T>>(
  options: RateOptions,
  downstream: Strategy<T, J>
) {
  const { intervalMs, intervalSlots = 1 } = options;

  const countsByMs = new Map<number, number>();
  let slotsUsed = 0;

  async function waitForSlot() {
    const nowMs = Date.now();

    // slots before slotExpiryMs have expired
    const slotExpiryMs = nowMs - intervalMs;

    // remove expired entries
    let slotDelayMs = 0;
    for (const [oldestMs, oldestCount] of countsByMs) {
      if (oldestMs >= slotExpiryMs) {
        // oldest not yet expired
        if (slotsUsed >= intervalSlots) {
          // calculate slot due
          slotDelayMs = intervalMs - (nowMs - oldestMs);
        }
        break;
      }
      // dispose records of expired slots
      slotsUsed -= oldestCount;
      countsByMs.delete(oldestMs);
    }

    // delay for slot if needed
    if (slotDelayMs > 0) {
      await sleep(slotDelayMs);
    }

    // record job
    const countNow = countsByMs.get(nowMs) ?? 0;
    countsByMs.set(nowMs, countNow + 1);
  }

  async function* createLaunches(): LaunchesGenerator<T, J> {
    try {
      await downstream.launches.next(); // prime generator to yield point
      for (;;) {
        const job = yield;
        await waitForSlot();
        const launchResult = await downstream.launches.next(job);
        if (launchResult.done === true) {
          break;
        }
      }
    } finally {
      await downstream.launches.return();
    }
  }

  return {
    launches: createLaunches(),
    settlements: downstream.settlements,
  };
}

export function createRatePipe(options: RateOptions): Pipe {
  return (createStrategy: StrategyFactory) =>
    <T, J extends Job<T>>() => {
      const downstream: Strategy<T, J> = createStrategy();
      return createRateStrategy<T, J>(options, downstream);
    };
}
