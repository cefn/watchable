/** Placeholder for a strategy that only allows jobs if there is a remaining slot in the current interval.
 * The interval is a moving window, and slots become available when historical job invocations become old enough
 */

import { sleep } from "../util";
import type {
  RateOptions,
  Job,
  LaunchesGenerator,
  Pipe,
  Strategy,
  StrategyFactory,
  NevermoreOptions,
} from "../types";

export function isRateOptions(
  options: NevermoreOptions
): options is RateOptions {
  const { intervalMs, intervalSlots } = options;
  const hasIntervalMs = typeof intervalMs === "number";
  const hasIntervalSlots = typeof intervalSlots === "number";
  if (hasIntervalSlots) {
    if (!hasIntervalMs) {
      throw new Error("intervalMs is required to specify a rate limit");
    }
  }
  return hasIntervalMs;
}

export function createRateStrategy<J extends Job<unknown>>(
  options: RateOptions,
  downstream: Strategy<J>
) {
  const { intervalMs, intervalSlots = 1 } = options;

  const countsByMs = new Map<number, number>();
  let slotsUsed = 0;

  async function waitForSlot() {
    if (slotsUsed >= intervalSlots) {
      // slots used - wait for oldest record to expire
      const oldestResult = countsByMs.entries().next();
      if (oldestResult.done === true) {
        // there must be an oldest record
        throw new Error(`Fatal: job record missing`);
      }
      const [timestamp, count] = oldestResult.value;

      // check when oldest slot expires
      const timestampNow = Date.now();
      if (timestamp >= timestampNow - intervalMs) {
        // not yet expired, wait for it
        await sleep(intervalMs - (timestampNow - timestamp));
      }
      // forget expired jobs
      slotsUsed -= count;
      countsByMs.delete(timestamp);
    }

    // record job
    slotsUsed++;
    const timestampNow = Date.now();
    const countNow = countsByMs.get(timestampNow) ?? 0;
    countsByMs.set(timestampNow, countNow + 1);
  }

  async function* createLaunches(): LaunchesGenerator<J> {
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
  } satisfies Strategy<J>;
}

export function createRatePipe(options: RateOptions): Pipe {
  return (createStrategy: StrategyFactory) =>
    <J extends Job<unknown>>() =>
      createRateStrategy<J>(options, createStrategy());
}
