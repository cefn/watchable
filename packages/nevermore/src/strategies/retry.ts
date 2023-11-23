/* eslint-disable @typescript-eslint/promise-function-async */
import type { Job, JobSettlement, RetryOptions, Strategy } from "../types";

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

  // TODO what pipe order will help to constrain this growing backlog?
  const failedRetryJobs: Array<RetryJob<T, J>> = [];

  async function* createLaunches(): AsyncGenerator<void, void, J> {
    try {
      for (;;) {
        const retryJob =
          failedRetryJobs.length > 0
            ? (failedRetryJobs.shift() as RetryJob<T, J>) // prioritise retries
            : createRetryJob<T, J>(yield); // else pull from upstream
        const launchResult = await downstream.launches.next(retryJob);
        if (launchResult.done === true) {
          break; // sequence ended downstream
        }
      }
    } finally {
      // handle upstream or downstream closure
      await downstream.launches.return?.();
    }
  }

  async function* createSettlements(): AsyncGenerator<JobSettlement<T, J>> {
    try {
      for (;;) {
        const iteratorResult = await downstream.settlements.next();
        if (iteratorResult.done === true) {
          break; // settlements sequence ended downstream
        }
        const { value: retrySettlement } = iteratorResult;
        const retryJob = retrySettlement.job;
        if (
          retrySettlement.status === "rejected" &&
          retryJob.jobFailures < retries
        ) {
          retryJob.jobFailures++;
          failedRetryJobs.push(retryJob);
        }
        yield {
          ...retrySettlement,
          job: retryJob.jobToRetry, // same notification, but unwrap the 'nested' job
        };
      }
    } finally {
      await downstream.settlements.return?.();
    }
  }

  return {
    launches: createLaunches(),
    settlements: createSettlements(),
  };
}
