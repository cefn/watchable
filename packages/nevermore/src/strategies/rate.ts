/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/return-await */
/** Placeholder for a strategy that only allows jobs if there is a remaining slot in the current interval.
 * The interval is a moving window, and slots become available when historical job invocations become old enough
 */

import { sleep } from "../util";
import type {
  RateOptions,
  Job,
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

  // TODO CH assess the worst-case scenarios where multiple re-entrant calls are all sleeping
  // but only one gets in at a time (hence everyone but one has to sleep again)
  // compare with overhead of just adding a lock (where jobs are implicitly queued on
  // the lock before entering the logic)
  async function waitForSlot() {
    while (slotsUsed >= intervalSlots) {
      // slots used - wait for oldest record to expire
      const oldestResult = countsByMs.entries().next();
      if (oldestResult.done === true) {
        // slots are used up so there must be an oldest record
        throw new Error(`Fatal: job record missing`);
      }
      const [timestamp, count] = oldestResult.value;

      // check when oldest slot expires
      const timestampNow = Date.now();
      const expiryDelay = intervalMs - (timestampNow - timestamp);
      if (expiryDelay > 0) {
        // not yet expired, wait for it and try again
        await sleep(expiryDelay);
        continue;
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

  const { next } = downstream;

  return {
    async launchJob(job) {
      await waitForSlot();
      return downstream.launchJob(job);
    },
    async launchesDone() {
      downstream.launchesDone();
    },
    next,
  } satisfies Strategy<J>;
}

export function createRatePipe(options: RateOptions): Pipe {
  return (createStrategy: StrategyFactory) =>
    <J extends Job<unknown>>() =>
      createRateStrategy<J>(options, createStrategy());
}
