import type {
  Job,
  JobSettlement,
  Pipe,
  Strategy,
  StrategyFactory,
} from "../types";
import { createNotifiable, namedRace } from "../util";

/** A strategy that tracks launches and settlements, responsible
 * for making the settlements iterator return. When launches are exhausted
 * and all active launches have yielded their settlements, this notifies
 * the consumer that the sequence of settlements has ended.
 */
export function createFinalizerStrategy<T, J extends Job<T>>(
  downstream: Strategy<T, J>
) {
  const launchesFinalized = createNotifiable();
  let activeJobs = 0;

  // pass jobs downstream
  // track active count
  // move to finalizing settlements when upstream or downstream 'return'
  async function* createLaunches(): AsyncGenerator<void, void, J> {
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
    }
  }

  // pass settlements upstream
  // query launches finalization and count outstanding settlements
  // when no more launches and no more settlements, end the sequence
  async function* createSettlements(): AsyncGenerator<JobSettlement<T, J>> {
    let settlementResultPromise: Promise<
      IteratorResult<JobSettlement<T, J>>
    > | null = null;

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
      settlementResultPromise = null;
      if (result.done === true) {
        // complete: settlements ended
        break;
      }
      yield result.value;
    }
  }

  return {
    launches: createLaunches(),
    settlements: createSettlements(),
  } as const satisfies Strategy<T, J>;
}

export function createFinalizerPipe(): Pipe {
  return (createStrategy: StrategyFactory) =>
    <T, J extends Job<T>>() => {
      const downstream: Strategy<T, J> = createStrategy();
      return createFinalizerStrategy<T, J>(downstream);
    };
}
