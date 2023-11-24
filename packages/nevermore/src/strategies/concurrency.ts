import type {
  Job,
  Strategy,
  ConcurrencyOptions,
  Pipe,
  NevermoreOptions,
  StrategyFactory,
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

export function createConcurrencyStrategy<J extends Job<unknown>>(
  options: ConcurrencyOptions & {
    downstream: Strategy<J>;
  }
): Strategy<J> {
  const { concurrency, downstream } = options;

  let pendingJobs = 0;
  let slotAnnouncement: ReturnType<typeof promiseWithFulfil> | null = null;

  async function* createLaunches(): LaunchesGenerator<J> {
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

  async function* createSettlements(): SettlementsGenerator<J> {
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
    <J extends Job<unknown>>() => {
      const downstream: Strategy<J> = createStrategy();

      return createConcurrencyStrategy<J>({
        concurrency,
        downstream,
      });
    };
}
