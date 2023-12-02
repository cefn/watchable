/** A strategy that ensures jobs taking more than a specified timeout settle as "rejected". */

import type {
  Job,
  NevermoreOptions,
  Pipe,
  Strategy,
  StrategyFactory,
  TimeoutOptions,
} from "../types";

export function isTimeoutOptions(
  options: NevermoreOptions
): options is TimeoutOptions {
  const { timeoutMs } = options;
  if (typeof timeoutMs === "number") {
    if (timeoutMs <= 0) {
      throw new Error(
        `timeoutMs must be a positive value: ${JSON.stringify({ timeoutMs })}`
      );
    }
    return true;
  }
  return false;
}

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

  const { launchesDone } = downstream;

  return {
    launchesDone,
    async launchJob(job) {
      const timeoutJob = createTimeoutJob<J>(job, timeoutMs);
      const launch = await downstream.launchJob(timeoutJob);
    },
    async next() {
      const settlementResult = await downstream.next();
      if (settlementResult.done) {
        return settlementResult;
      }
      const { value: timeoutSettlement } = settlementResult;
      const {
        job: { jobToTimeout },
      } = timeoutSettlement;
      // pass back settlement event
      // but reference the original job
      return {
        // TODO CH simplify restructure
        done: false,
        value: {
          ...timeoutSettlement,
          job: jobToTimeout,
        },
      };
    },
  } as Strategy<J>;
}

export function createTimeoutPipe(options: TimeoutOptions): Pipe {
  return (createStrategy: StrategyFactory) =>
    <J extends Job<unknown>>() =>
      createTimeoutStrategy<J>(options, createStrategy());
}
