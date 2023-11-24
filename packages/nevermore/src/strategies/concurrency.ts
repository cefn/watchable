import type {
  Job,
  Strategy,
  ConcurrencyOptions,
  Pipe,
  NevermoreOptions,
  StrategyFactory,
  JobSettlement,
  LaunchesGenerator,
  SettlementsGenerator,
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
): Strategy<T, J> {
  const { concurrency, downstream } = options;

  let pendingJobs = 0;
  let slotAnnouncement: ReturnType<typeof promiseWithFulfil> | null = null;

  async function* createLaunches(): LaunchesGenerator<T, J> {
    try {
      await downstream.launches.next(); // prime downstream generator
      for (;;) {
        if (slotAnnouncement !== null) {
          // concurrency exceeded - wait for slot
          await slotAnnouncement.promise;
        }
        // accept next job
        const job = yield;
        // account for launch request
        pendingJobs++;
        // check if concurrency exceeded
        if (pendingJobs === concurrency) {
          // slots now unavailable, prepare announcement of slot availability
          slotAnnouncement = promiseWithFulfil();
        }
        // request job launch
        // wait for downstream to yield next launch
        const launchResult = await downstream.launches.next(job);
        if (launchResult.done === true) {
          break;
        }
      }
    } finally {
      await downstream.launches.return();
    }
  }

  async function* createSettlements(): SettlementsGenerator<T, J> {
    try {
      for (;;) {
        // wait for downstream to yield a settlement
        const result = await downstream.settlements.next();
        // check it's a job settlement (not a sequence end)
        if (result.done === true) {
          break;
        }
        // account for settlement
        pendingJobs--;
        // make slot announcement if it's awaited
        if (slotAnnouncement !== null) {
          slotAnnouncement.fulfil();
          slotAnnouncement = null;
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
  };
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
