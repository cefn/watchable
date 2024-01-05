/* eslint-disable @typescript-eslint/no-confusing-void-expression */
/**  */
import { createMutex } from "../mutex";
import type {
  Job,
  Strategy,
  ConcurrencyOptions,
  Pipe,
  NevermoreOptions,
  StrategyFactory,
} from "../types";
import { type Biddable, createBiddablePromise } from "../util";

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

  let slotsUsed = 0;
  let deferredSlot: Biddable | null = null;
  const launchMutex = createMutex();

  const { launchesDone } = downstream;

  return {
    launchesDone,
    async launchJob(job) {
      // mutex prevent multiple requesters entering the flow, waiting on the same slot announcement promise
      // they would get unblocked all at once rather than waiting their turn
      // TODO CH avoid wrapping this whole method in a mutex ( use while loop on pendingJobs
      // to ensure only a single job gets through each time, like rate logic? )
      const unlock = await launchMutex.lock();
      try {
        if (deferredSlot !== null) {
          // concurrency exceeded - wait for slot
          await deferredSlot.promise;
        }
        // record launch request
        slotsUsed++;
        // check if concurrency exceeded
        if (slotsUsed === concurrency) {
          if (deferredSlot !== null) {
            throw new Error("Fatal: multiple requests for deferredSlot");
          }
          // final slot just filled, create deferredSlot for next job to wait on
          deferredSlot = createBiddablePromise();
        }
      } finally {
        unlock();
      }
      return await downstream.launchJob(job);
    },
    async next() {
      const result = await downstream.next();
      if (result.done !== true) {
        // account for settlement
        slotsUsed--;
        // wake any process waiting on the deferred slot
        if (deferredSlot !== null) {
          deferredSlot.fulfil();
          deferredSlot = null;
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
