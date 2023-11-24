/** A strategy that ensures jobs taking more than a specified timeout settle as "rejected". */

import type {
  Job,
  LaunchesGenerator,
  Pipe,
  SettlementsGenerator,
  Strategy,
  StrategyFactory,
  TimeoutOptions,
} from "../types";

type TimeoutJob<T, J extends Job<T>> = (() => Promise<T>) & {
  jobToTimeout: J;
  timeoutMs: number;
};

function createTimeoutJob<T, J extends Job<T>>(
  jobToTimeout: J,
  timeoutMs: number
): TimeoutJob<T, J> {
  return Object.assign(
    async () => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        const jobPromise = jobToTimeout();

        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(() => {
            timeoutId = null;
            reject(new Error(`Job timed out after ${timeoutMs} ms.`));
          }, timeoutMs);
        });

        return await Promise.race([jobPromise, timeoutPromise]);
      } finally {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      }
    },
    {
      jobToTimeout,
      timeoutMs,
    }
  );
}

export function createTimeoutStrategy<T, J extends Job<T>>(
  options: TimeoutOptions,
  downstream: Strategy<T, TimeoutJob<T, J>>
) {
  const { timeoutMs } = options;

  async function* createLaunches(): LaunchesGenerator<T, J> {
    try {
      await downstream.launches.next(); // prime generator to yield point
      for (;;) {
        const job = yield;
        const timeoutJob = createTimeoutJob<T, J>(job, timeoutMs);
        const launchResult = await downstream.launches.next(timeoutJob);
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
        const settlementResult = await downstream.settlements.next();
        if (settlementResult.done === true) {
          break;
        }
        const { value: timeoutSettlement } = settlementResult;
        const {
          job: { jobToTimeout },
        } = timeoutSettlement;
        // pass back settlement event
        // but reference the original job
        yield {
          ...timeoutSettlement,
          job: jobToTimeout,
        };
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

export function createTimeoutPipe(options: TimeoutOptions): Pipe {
  return (createStrategy: StrategyFactory) =>
    <T, J extends Job<T>>() => {
      const downstream: Strategy<T, TimeoutJob<T, J>> = createStrategy();
      return createTimeoutStrategy<T, J>(options, downstream);
    };
}
