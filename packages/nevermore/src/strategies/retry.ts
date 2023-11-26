/** This strategy retries all failing jobs for a specified number of retries before passing them back as rejected */

/* eslint-disable @typescript-eslint/promise-function-async */
import { promiseWithFulfil } from "..";
import type {
  Job,
  Strategy,
  LaunchesGenerator,
  SettlementsGenerator,
  NevermoreOptions,
  RetryOptions,
  StrategyFactory,
  Pipe,
} from "../types";

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
): Strategy<J> {
  const { retries } = options;

  const settlementsFinalized = promiseWithFulfil();

  async function* createLaunches(): LaunchesGenerator<J> {
    await downstream.launches.next(); // prime downstream generator
    try {
      for (;;) {
        // pull through a new job
        const job = yield;
        const retryJob = createRetryJob(job);
        const launchResult = await downstream.launches.next(retryJob);
        if (launchResult.done === true) {
          break; // sequence ended downstream
        }
      }
    } finally {
      // handle upstream or downstream closure

      /** Suspend downstream.launches.return()
       * until we believe there will be no more retries
       * (retries are replayed through downstream.launches). */
      await settlementsFinalized.promise;
      await downstream.launches.return();
    }
  }

  const launches = createLaunches();

  async function* createSettlements(): SettlementsGenerator<J> {
    try {
      for (;;) {
        const downstreamResult = await downstream.settlements.next();
        if (downstreamResult.done === true) {
          break; // settlements sequence ended downstream
        }
        const { value: retrySettlement } = downstreamResult;
        const { status, job: retryJob } = retrySettlement;
        const { jobToRetry } = retryJob;
        // intercept failures needing a retry
        if (status === "rejected") {
          if (retryJob.jobFailures < retries) {
            // retries remain. record failure, schedule retry
            retryJob.jobFailures++;
            // TODO CH handle result from this call?
            await downstream.launches.next(retryJob);
            continue;
          } else {
            // no more retries. serve back rejection, referencing original job
            yield {
              ...retrySettlement,
              job: jobToRetry,
            };
          }
        } else {
          // job was successful, serve back fulfilment, referenceing original job
          yield {
            ...retrySettlement,
            job: retryJob.jobToRetry,
          };
        }
      }
    } finally {
      settlementsFinalized.fulfil();
      await downstream.settlements.return();
    }
  }

  return {
    launches,
    settlements: createSettlements(),
  } satisfies Strategy<J>;
}

export function createRetryPipe(options: RetryOptions): Pipe {
  return (createStrategy: StrategyFactory) =>
    <J extends Job<unknown>>() =>
      createRetryStrategy<J>(options, createStrategy());
}
