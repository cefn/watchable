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

type TimeoutJob<J extends Job<unknown>> = (() => Promise<ReturnType<J>>) & {
  jobToTimeout: J;
  timeoutMs: number;
};

function createTimeoutJob<J extends Job<unknown>>(
  jobToTimeout: J,
  timeoutMs: number
): TimeoutJob<J> {
  return Object.assign(
    async () => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        const jobPromise = jobToTimeout() as Promise<
          Awaited<ReturnType<typeof jobToTimeout>>
        >;

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

export function createTimeoutStrategy<J extends Job<unknown>>(
  options: TimeoutOptions,
  downstream: Strategy<TimeoutJob<J>>
) {
  const { timeoutMs } = options;

  async function* createLaunches(): LaunchesGenerator<J> {
    try {
      await downstream.launches.next(); // prime generator to yield point
      for (;;) {
        const job = yield;
        const timeoutJob = createTimeoutJob<J>(job, timeoutMs);
        const launchResult = await downstream.launches.next(timeoutJob);
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
  } satisfies Strategy<J>;
}

export function createTimeoutPipe(options: TimeoutOptions): Pipe {
  return (createStrategy: StrategyFactory) =>
    <J extends Job<unknown>>() =>
      createTimeoutStrategy<J>(options, createStrategy());
}
