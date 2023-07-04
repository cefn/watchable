import {
  Job,
  NevermoreOptions,
  Pipe,
  RetryOptions,
  Strategy,
  StrategyFactory,
  promiseWithFulfil,
} from "..";
import { createLock } from "../lock";

export class SkipRetryError extends Error {
  constructor(message: string, readonly originalError?: Error) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isRetryOptions(
  options: NevermoreOptions
): options is RetryOptions {
  const { retries } = options;
  if (typeof retries === "number") {
    if (retries < 1) {
      throw new Error(
        `Retries must be a positive integer. Received ${JSON.stringify({
          retries,
        })}`
      );
    }
    return true;
  }
  return false;
}

type RetryJob<J extends Job<unknown>> = (() => ReturnType<J>) & {
  jobToRetry: J;
  jobFailures: number;
};

function createRetryJob<J extends Job<unknown>>(jobToRetry: J): RetryJob<J> {
  const retryJob: RetryJob<J> = Object.assign(
    () => jobToRetry() as ReturnType<J>,
    {
      jobToRetry,
      jobFailures: 0,
    }
  );

  return retryJob;
}

export function createRetryStrategy<J extends Job<unknown>>(
  options: RetryOptions,
  downstream: Strategy<RetryJob<J>>
) {
  const { retries } = options;

  const retryLock = createLock();
  const settlementsFinalized = promiseWithFulfil();
  let activeJobs = 0;
  let upstreamLaunchesDone = false;

  async function launchRetryJob(retryJob: RetryJob<J>) {
    const release = await retryLock.acquire();
    try {
      await downstream.launchJob(retryJob);
    } finally {
      release();
    }
  }

  return {
    async launchJob(job) {
      activeJobs++;
      const retryJob = createRetryJob(job);
      await launchRetryJob(retryJob);
    },
    async launchesDone() {
      upstreamLaunchesDone = true;
      await settlementsFinalized.promise;
      downstream.launchesDone();
    },
    async next() {
      for (;;) {
        const downstreamResult = await downstream.next();
        if (downstreamResult.done === true) {
          return downstreamResult;
        }

        const settlement = downstreamResult.value;
        const { job: retryJob, status } = settlement;
        const { jobToRetry } = retryJob;

        if (
          status === "rejected" &&
          retryJob.jobFailures < retries &&
          !(settlement.reason instanceof SkipRetryError) // TODO CH should replace reason with `originalError`?
        ) {
          // retry job
          retryJob.jobFailures++;
          launchRetryJob(retryJob);
          continue;
        }

        // give up on job
        activeJobs--;
        if (upstreamLaunchesDone && activeJobs === 0) {
          settlementsFinalized.fulfil();
        }
        return {
          ...downstreamResult,
          value: {
            ...settlement,
            job: jobToRetry,
          },
        };
      }
    },
  } satisfies Strategy<J>;
}

export function createRetryPipe(options: RetryOptions): Pipe {
  return (createStrategy: StrategyFactory) =>
    <J extends Job<unknown>>() =>
      createRetryStrategy<J>(options, createStrategy());
}
