/* eslint-disable @typescript-eslint/no-misused-promises */
import type {
  NevermoreOptions,
  Job,
  Strategy,
  StrategyFactory,
  Pipe,
  BackoffRetryOptions,
} from "../types";
import { createLock } from "../lock";
import { createBiddablePromise, sleep } from "../util";

function typedKeys<T extends object>(obj: T) {
  return Object.keys(obj) as Array<keyof T>;
}

const BACKOFF_OPTION_MINIMUMS = {
  backoffGrowth: 1,
  backoffMaxExponent: 1,
  backoffJitter: 0,
} as const;

export function isRetryOptions(
  options: NevermoreOptions
): options is BackoffRetryOptions {
  // check if a core option is set
  if (
    typeof options.backoffMs === "number" ||
    typeof options.retries === "number"
  ) {
    // Ensure other number options are within valid range.
    const invalidKeys = typedKeys(BACKOFF_OPTION_MINIMUMS).filter((key) => {
      const option = options[key];
      return (
        typeof option === "number" && option < BACKOFF_OPTION_MINIMUMS[key]
      );
    });
    if (invalidKeys.length > 0) {
      throw new Error(
        `Invalid BackoffOptions: [\n${invalidKeys
          .map(
            (key) =>
              `Option ${key} cannot be below ${BACKOFF_OPTION_MINIMUMS[key]}`
          )
          .join("\n")}\n]`
      );
    }
    if (
      typeof options.backoffJitter === "number" &&
      options.backoffJitter > 1.0
    ) {
      throw new Error(`backoffJitter cannot be greater than 1`);
    }
    // BackoffOptions is valid
    return true;
  }

  // Ensure no surplus options are provided (they are invalid and ignored without the core options)
  // the simplified definition of NevermoreOptions means all options are considered partial
  if (
    typeof options.retries !== "number" &&
    typeof options.backoffMs !== "number"
  ) {
    if (typeof options.retryAllowed !== "undefined") {
      throw new Error(
        "The 'retryAllowed' parameter must be accompanied by 'retries' or 'backoffMs"
      );
    }
  }
  if (typeof options.backoffMs !== "number") {
    for (const surplusOption of [
      "backoffGrowth",
      "backoffJitter",
      "backoffMaxExponent",
    ] as const) {
      if (typeof options[surplusOption] !== "undefined") {
        throw new Error(
          `The ${surplusOption} option must be accompanied by 'backoffMs'`
        );
      }
    }
  }
  return false;
}

export type BackoffJob<J extends Job<unknown>> = (() => ReturnType<J>) & {
  jobToRetry: J;
  jobFailures: number;
};

export function createBackoffJob<J extends Job<unknown>>(
  jobToRetry: J
): BackoffJob<J> {
  // TODO examine sequencing consequences of adjustForFailure here
  // instead of when dequeuing settlements. Likely make delayMs changes
  //  more instantaneous
  const retryJob: BackoffJob<J> = Object.assign(
    () => jobToRetry() as ReturnType<J>,
    {
      jobToRetry,
      jobFailures: 0,
    }
  );

  return retryJob;
}

function withJitter(delayMs: number, backoffJitter: number) {
  return delayMs * (1 - backoffJitter + Math.random() * 2 * backoffJitter);
}

export function createBackoffStrategy<J extends Job<unknown>>(
  options: BackoffRetryOptions,
  downstream: Strategy<BackoffJob<J>>
) {
  const {
    backoffMs = null,
    backoffGrowth = 2,
    backoffMaxExponent = 10,
    backoffJitter = 0.1,
    retries = null,
    retryAllowed = null,
  } = options;

  let sequentialFailures = 0;
  let delayMs = 0;

  const retryLock = createLock();
  const settlementsFinalized = createBiddablePromise();
  let activeJobs = 0;
  let upstreamLaunchesDone = false;

  const adjustForSuccess =
    backoffMs !== null
      ? () => {
          // send fulfilment downstream
          sequentialFailures = 0;
          delayMs = 0;
        }
      : null;

  const adjustForFailure =
    backoffMs !== null
      ? () => {
          // don't sent rejection downstream
          // record failure for backoff calculation
          sequentialFailures++;
          if (sequentialFailures === 1) {
            delayMs = backoffMs;
          } else if (sequentialFailures <= backoffMaxExponent + 1) {
            delayMs = delayMs * backoffGrowth;
          }
        }
      : null;

  async function launchBackoffRetryJob(retryJob: BackoffJob<J>) {
    const release = await retryLock.acquire();
    // only increment delay up to backoff ceiling
    if (delayMs > 0) {
      if (typeof backoffJitter === "number" && backoffJitter > 0) {
        await sleep(withJitter(delayMs, backoffJitter));
      } else {
        await sleep(delayMs);
      }
    }
    try {
      await downstream.launchJob(retryJob);
    } finally {
      release();
    }
  }

  return {
    async launchJob(job) {
      // register newly launched jobs, wrap in a backoff job
      activeJobs++;
      const backoffRetryJob = createBackoffJob(job);
      await launchBackoffRetryJob(backoffRetryJob);
    },
    async launchesDone() {
      // notify launchesDone downstream only when we
      // know all jobs are settled, and retries of backoff jobs
      // will no longer happen
      upstreamLaunchesDone = true;
      await settlementsFinalized.promise;
      downstream.launchesDone();
    },
    async next() {
      // iterate all settlements and reschedule failures
      // back into the pipeline, managing a backoff delay
      // depending on recent failure history
      for (;;) {
        const downstreamResult = await downstream.next();
        if (downstreamResult.done === true) {
          return downstreamResult;
        }

        const settlement = downstreamResult.value;
        const { job: retryJob, status } = settlement;
        const { jobToRetry } = retryJob;

        if (status === "fulfilled") {
          adjustForSuccess?.();
        } else {
          adjustForFailure?.();
          retryJob.jobFailures++;
          // retry attempted if error kind is allowed and retry count not reached
          if (
            (retryAllowed !== null ? retryAllowed(settlement.reason) : true) &&
            (typeof retries !== "number" || retryJob.jobFailures <= retries)
          ) {
            // retry job
            void launchBackoffRetryJob(retryJob);
            continue;
          }
        }
        // record job no longer active
        activeJobs--;
        if (upstreamLaunchesDone && activeJobs === 0) {
          settlementsFinalized.fulfil();
        }

        // rewrite fulfilment or rejection
        // to point to original job
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

export function createRetryPipe(options: BackoffRetryOptions): Pipe {
  return (createStrategy: StrategyFactory) =>
    <J extends Job<unknown>>() =>
      createBackoffStrategy<J>(options, createStrategy());
}
