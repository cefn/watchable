/** A strategy that ensures jobs taking more than a specified timeout settle as "rejected". */

import { namedRace } from "..";
import type {
  Job,
  JobArgs,
  NevermoreOptions,
  Pipe,
  Strategy,
  StrategyFactory,
  TimeoutOptions,
} from "../types";
import { createBiddablePromise, serializeError } from "../util";

export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Job timed out after ${timeoutMs} ms.`);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

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

type TimeoutJob<J extends Job<unknown>> = J extends Job<infer T>
  ? Job<T> & {
      jobToTimeout: J;
      timeoutMs: number;
    }
  : never;

function createTimeoutJob<J extends Job<unknown>>(
  jobToTimeout: J,
  timeoutMs: number
): TimeoutJob<J> {
  const jobWithTimeout = async (...args: JobArgs) => {
    // access global cancel (if provided)
    const upstreamCancelPromise = args[0]?.cancelPromise;
    // create local cancel
    const downstreamCancelBiddable = createBiddablePromise();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      // promise job execution, providing a private cancellation promise
      // so job can clean up from timeout
      const jobPromise = jobToTimeout({
        cancelPromise: downstreamCancelBiddable.promise,
      });

      // create timeout promise
      const timeoutPromise = new Promise<void>((resolve) => {
        timeoutId = setTimeout(() => {
          timeoutId = null;
          resolve();
        }, timeoutMs);
      });

      const winner = await namedRace({
        settle: jobPromise,
        timeout: timeoutPromise,
        ...(typeof upstreamCancelPromise !== "undefined"
          ? { upstreamCancel: upstreamCancelPromise }
          : null),
      });
      if (winner !== "settle") {
        // Not a settlement. Must be early termination (timeout or upstreamCancel)
        // trigger a downstream cancel
        downstreamCancelBiddable.fulfil();
        // handle eventual errors from (now-ignored) job
        jobPromise.catch((error) => {
          console.log(
            `Ignoring eventual error ${serializeError(
              error
            )}. Job already timed out`
          );
        });
      }
      if (winner === "timeout") {
        throw new TimeoutError(timeoutMs);
      }
      // resolve to job settlement or job cancel behaviour
      // (triggered by the downstream cancel happening in the background)
      return await jobPromise;
    } finally {
      // typescript is wrong about code-paths here. `timeoutId` can be non-null
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  };
  return Object.assign(jobWithTimeout, {
    jobToTimeout,
    timeoutMs,
  }) as TimeoutJob<J>;
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
      await downstream.launchJob(timeoutJob);
    },
    async next() {
      const settlementResult = await downstream.next();
      // settlements have terminated
      if (settlementResult.done === true) {
        return settlementResult;
      }

      // prepare to reconcile settlement result (needs job, not timeoutJob)
      const { value: timeoutJobSettlement } = settlementResult;
      const { status } = timeoutJobSettlement;

      // typescript apparently can't infer jobToTimeout is J
      const job = timeoutJobSettlement.job.jobToTimeout as J;
      if (status === "fulfilled") {
        // typescript apparently can't infer value is completion of J
        const jobValue = timeoutJobSettlement.value as unknown as Awaited<
          ReturnType<J>
        >;
        return {
          done: false,
          value: {
            ...timeoutJobSettlement,
            value: jobValue,
            job,
          },
        };
      } else {
        return {
          done: false,
          value: {
            ...timeoutJobSettlement,
            job,
          },
        };
      }
    },
  } satisfies Strategy<J>;
}

export function createTimeoutPipe(options: TimeoutOptions): Pipe {
  return (createStrategy: StrategyFactory) =>
    <J extends Job<unknown>>() =>
      createTimeoutStrategy<J>(options, createStrategy());
}
