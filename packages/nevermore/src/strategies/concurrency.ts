/**  */
import type {
  Job,
  Strategy,
  ConcurrencyOptions,
  Pipe,
  NevermoreOptions,
  StrategyFactory,
} from "../types";
import { promiseWithFulfil } from "../util";

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
  let slotAnnouncement: ReturnType<typeof promiseWithFulfil> | null = null;

  const { launchesDone } = downstream;

  return {
    launchesDone,
    async launchJob(job) {
      if (slotAnnouncement !== null) {
        // concurrency exceeded - wait for slot
        await slotAnnouncement.promise;
      }
      // record launch request
      pendingJobs++;
      // check if concurrency exceeded
      if (pendingJobs === concurrency) {
        // final slot now filled, prepare announcement
        // for future settlement to 'free' slot availability
        slotAnnouncement = promiseWithFulfil();
      }
      return await downstream.launchJob(job);
    },
    async next() {
      const result = await downstream.next();
      if (!result.done) {
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
