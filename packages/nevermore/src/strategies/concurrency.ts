import type {
  Job,
  Strategy,
  ConcurrencyOptions,
  Pipe,
  NevermoreOptions,
  StrategyFactory,
} from "../types";
import { promiseWithFulfil } from "../util";

export function validateConcurrency(
  options: NevermoreOptions,
  validateOptions: { throwError: boolean } = { throwError: false }
): options is ConcurrencyOptions {
  const { concurrency } = options;
  const { throwError } = validateOptions;
  const result = typeof concurrency === "number" && concurrency > 0;
  if (!result && throwError) {
    throw new Error(
      `Concurrency cannot be less than 1 : ${JSON.stringify({ concurrency })}`
    );
  }
  return result;
}

export function createConcurrencyStrategy<T, J extends Job<T>>(
  options: ConcurrencyOptions & {
    downstream: Strategy<T, J>;
  }
) {
  const { concurrency, downstream } = options;

  let pendingJobs = 0;
  let slotAnnouncement: ReturnType<typeof promiseWithFulfil> | null = null;

  const concurrencyStrategy: Strategy<T, J> = {
    launches: {
      async next(job: J) {
        if (slotAnnouncement !== null) {
          // concurrency exceeded - wait for slot
          await slotAnnouncement.promise;
        }
        // account for launch request
        pendingJobs++;
        // check if concurrency exceeded
        if (pendingJobs === concurrency) {
          // prepare announcement of slot availability
          slotAnnouncement = promiseWithFulfil();
        }
        // request job launch
        // wait for downstream to yield next launch
        return await downstream.launches.next(job);
      },
    },
    settlements: {
      async next() {
        // wait for downstream to yield a settlement
        const result = await downstream.settlements.next();
        // check it's a job settlement (not a sequence end)
        if (result.done === false) {
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
    },
  };

  return concurrencyStrategy;
}

export function createConcurrencyPipe(options: ConcurrencyOptions): Pipe {
  const { concurrency } = options;

  return (createStrategy: StrategyFactory) =>
    <T, J extends Job<T>>() => {
      const downstream: Strategy<T, J> = createStrategy();

      return createConcurrencyStrategy<T, J>({
        concurrency,
        downstream,
      });
    };
}
