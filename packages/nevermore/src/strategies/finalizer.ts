import type {
  Job,
  JobSettlement,
  LaunchesGenerator,
  Pipe,
  SettlementsGenerator,
  Strategy,
  StrategyFactory,
} from "../types";
import { createNotifiable, namedRace } from "../util";

/** A strategy that tracks launches and settlements. When launches are exhausted
 * and all active launches have yielded their settlements, it calls
 * settlements.return() notifying the pipeline that the sequence of settlements
 * has ended.
 */
export function createFinalizerStrategy<J extends Job<unknown>>(
  downstream: Strategy<J>
) {
  const launchesFinalized = createNotifiable();
  let activeJobs = 0;

  // pass jobs downstream
  // track active count
  // move to finalizing settlements when upstream or downstream 'return'
  async function* createLaunches(): LaunchesGenerator<J> {
    await downstream.launches.next(); // prime downstream generator (to reach yield point)
    try {
      for (;;) {
        const job = yield;
        activeJobs++;
        const result = await downstream.launches.next(job);
        if (result.done === true) {
          break;
        }
      }
    } finally {
      launchesFinalized.notify();
      await downstream.launches.return();
    }
  }

  // pass settlements upstream
  // query launches finalization and count outstanding settlements
  // when no more launches and no more settlements, end the sequence
  async function* createSettlements(): SettlementsGenerator<J> {
    let settlementResultPromise: Promise<
      IteratorResult<JobSettlement<J>>
    > | null = null;
    try {
      for (;;) {
        // check finalization
        if (launchesFinalized.notified && activeJobs === 0) {
          // settlements finalized (launches finalised and nothing more in flight)
          break;
        }
        // initialise result promise (or refresh if 'used up' in last loop)
        if (settlementResultPromise === null) {
          settlementResultPromise = downstream.settlements.next();
        }
        // if launches not yet complete wait on both launch completion AND settlement
        // (after launch completion, may learn that further result will never come)
        if (!launchesFinalized.notified) {
          const winner = await namedRace({
            launchesFinalized: launchesFinalized.promise,
            settlementResult: settlementResultPromise,
          });
          if (winner === "launchesFinalized") {
            // loop again to reconsider if settlements now completed
            continue;
          }
        }
        // handle settlements result, reset promise
        const result = await settlementResultPromise;
        activeJobs--;
        settlementResultPromise = null;
        if (result.done === true) {
          // complete: settlements ended
          break;
        }
        yield result.value;
      }
    } finally {
      await downstream.settlements.return();
    }
  }

  return {
    launches: createLaunches(),
    settlements: createSettlements(),
  } satisfies Strategy<J>;
}

export function createFinalizerPipe(): Pipe {
  return (createStrategy: StrategyFactory) =>
    <J extends Job<unknown>>() =>
      createFinalizerStrategy<J>(createStrategy());
}
