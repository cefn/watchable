/* eslint-disable @typescript-eslint/no-confusing-void-expression */
/**  */
import { createLock } from "../lock";
import type {
  Job,
  Strategy,
  ConcurrencyOptions,
  Pipe,
  NevermoreOptions,
  StrategyFactory,
} from "../types";
import { createBiddablePromise } from "../util";

export function isConcurrencyOptions(
  options: NevermoreOptions
): options is ConcurrencyOptions {
  const { concurrency } = options;
  if (typeof concurrency === "number") {
    if (concurrency <= 0) {
      throw new Error(
        `Concurrency cannot be less than 1 : ${JSON.stringify({ concurrency })}`
      );
    }
    return true;
  }
  return false;
}

export function createConcurrencyStrategy<J extends Job<unknown>>(
  options: ConcurrencyOptions,
  downstream: Strategy<J>
): Strategy<J> {
  const { concurrency } = options;

  let pendingJobs = 0;
  let slotAnnouncement: ReturnType<typeof createBiddablePromise> | null = null;

  const { launchesDone } = downstream;
  const launchLock = createLock();

  return {
    launchesDone,
    async launchJob(job) {
      // mutex prevent multiple requesters entering the flow, waiting on the same slot announcement promise
      // they would get unblocked all at once rather than waiting their turn
      // TODO CH avoid wrapping this whole method in a mutex ( use while loop on pendingJobs
      // to ensure only a single job gets through each time, like rate logic? )
      const release = await launchLock.acquire();
      try {
        if (slotAnnouncement !== null) {
          // concurrency exceeded - wait for slot
          await slotAnnouncement.promise;
        }
        // record launch request
        pendingJobs++;
        // check if concurrency exceeded
        if (pendingJobs === concurrency) {
          if (slotAnnouncement !== null) {
            throw new Error("Fatal: duplicate slot announcement requested");
          }
          // final slot now filled, prepare announcement
          // for future settlement that will 'free' slot availability
          slotAnnouncement = createBiddablePromise();
        }
      } finally {
        release();
      }
      return await downstream.launchJob(job);
    },
    async next() {
      const result = await downstream.next();
      if (result.done !== true) {
        // account for settlement
        pendingJobs--;
        // make slot announcement if it's awaited
        if (slotAnnouncement !== null) {
          slotAnnouncement.fulfil();
          slotAnnouncement = null;
        }
      }
      return result;
    },
  } satisfies Strategy<J>;
}

export function createConcurrencyPipe(options: ConcurrencyOptions): Pipe {
  return (createStrategy: StrategyFactory) =>
    <J extends Job<unknown>>() =>
      createConcurrencyStrategy<J>(options, createStrategy());
}
