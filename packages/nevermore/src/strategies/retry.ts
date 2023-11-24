/** This strategy retries all failing jobs for a specified number of retries before passing them back as rejected */

/* eslint-disable @typescript-eslint/promise-function-async */
import type {
  Job,
  LaunchesGenerator,
  RetryOptions,
  SettlementsGenerator,
  Strategy,
} from "../types";

type RetryJob<T, J extends Job<T>> = (() => Promise<T>) & {
  jobToRetry: J;
  jobFailures: number;
};

function createRetryJob<T, J extends Job<T>>(jobToRetry: J): RetryJob<T, J> {
  const retryJob = Object.assign(() => jobToRetry(), {
    jobToRetry,
    jobFailures: 0,
  });

  return retryJob;
}

export function createRetryStrategy<T, J extends Job<T>>(
  options: RetryOptions,
  downstream: Strategy<T, RetryJob<T, J>>
): Strategy<T, J> {
  const { retries } = options;

  // TODO CH what pipe order/checks should constrain this growing backlog?
  const failedRetryJobs: Array<RetryJob<T, J>> = [];

  async function* createLaunches(): LaunchesGenerator<T, J> {
    await downstream.launches.next(); // prime downstream generator
    try {
      for (;;) {
        const retryJob =
          failedRetryJobs.length > 0
            ? (failedRetryJobs.shift() as RetryJob<T, J>) // prioritise clearing existing retries
            : createRetryJob<T, J>(yield); // else wrap a new upstream job
        const launchResult = await downstream.launches.next(retryJob);
        if (launchResult.done === true) {
          break; // sequence ended downstream
        }
      }
    } finally {
      // handle upstream or downstream closure
      await downstream.launches.return();
    }
  }

  async function* createSettlements(): SettlementsGenerator<T, J> {
    try {
      for (;;) {
        const iteratorResult = await downstream.settlements.next();
        if (iteratorResult.done === true) {
          break; // settlements sequence ended downstream
        }
        const { value: retrySettlement } = iteratorResult;
        const retryJob = retrySettlement.job;
        // intercept failures needing a retry
        if (
          retrySettlement.status === "rejected" &&
          retryJob.jobFailures < retries
        ) {
          // record failure and schedule retry
          retryJob.jobFailures++;
          failedRetryJobs.push(retryJob);
          continue;
        }
        // pass back other fulfilled or rejected events
        // but reference the original job
        yield {
          ...retrySettlement,
          job: retryJob.jobToRetry,
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
