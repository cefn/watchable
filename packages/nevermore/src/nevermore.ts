import type {
  Job,
  JobSettlement,
  NevermoreOptions,
  Pipe,
  PipeOptions,
} from "./types";
import { asyncIterable } from "./util";
import {
  createLauncherStrategy,
  createRatePipe,
  createRetryPipe,
  createTimeoutPipe,
  createConcurrencyPipe,
  isConcurrencyOptions,
  isRateOptions,
  isRetryOptions,
  isTimeoutOptions,
} from "./strategies";

function isPipeOptions(options: NevermoreOptions): options is PipeOptions {
  return typeof options.pipes !== "undefined";
}

/** Sequence the pipes (strategy wrappers) specified by caller. */
function* pipesFromOptions(
  options: NevermoreOptions & {
    pipes?: Pipe[];
  }
) {
  if (isTimeoutOptions(options)) {
    // give up on slow jobs
    yield createTimeoutPipe(options);
  }
  if (isConcurrencyOptions(options)) {
    // limit number of simultaneously running jobs
    yield createConcurrencyPipe(options);
  }
  if (isRateOptions(options)) {
    // constrain jobs launched within an interval
    yield createRatePipe(options);
  }
  // order ensures also re-inserted retry jobs
  // are limited by concurrency, rate, timeout
  if (isRetryOptions(options)) {
    // repeat failing jobs a certain number of times
    yield createRetryPipe(options);
  }
  // wire pipes passed by caller
  if (isPipeOptions(options)) {
    yield* options.pipes;
  }
}

export function createStrategyFromOptions<J extends Job<unknown>>(
  options: NevermoreOptions
) {
  const { cancelPromise } = options;
  /** COMPOSE STRATEGY */

  // define a factory that creates a settler strategy
  // (a strategy that attempts to immediately settle every job)
  // tracks launched jobs, ends settlements when all jobs are settled

  let createStrategy = <J extends Job<unknown>>() =>
    createLauncherStrategy<J>(cancelPromise);

  // compose further factories specified by caller (wrapping settler factory)
  for (const pipe of pipesFromOptions(options)) {
    createStrategy = pipe(createStrategy);
  }

  // execute all wrapped factories, creating a composed strategy
  return createStrategy<J>();
}

/**
 * @param jobs An array, generator or other Iterable. Nevermore will pull jobs from it just-in-time.
 * @param options.cancelPromise If provided, Nevermore will cease launching jobs whenever this promise settles.
 * @returns
 */
export async function* nevermore<J extends Job<unknown>>(
  options: NevermoreOptions,
  jobs:
    | Iterable<J>
    | AsyncIterable<J>
    | (() => Generator<J>)
    | (() => AsyncGenerator<J>)
): AsyncIterable<JobSettlement<J>> {
  const strategy = createStrategyFromOptions<J>(options);

  /** PUSH JOBS */

  // if jobs is a generator function, create an iterable from it
  const jobIterable =
    Symbol.iterator in jobs || Symbol.asyncIterator in jobs ? jobs : jobs();

  // push jobs into strategy as fast as possible
  async function pushJobs() {
    try {
      for await (const job of jobIterable) {
        await strategy.launchJob(job);
      }
    } finally {
      strategy.launchesDone();
    }
  }

  // run in background
  void pushJobs();

  /** PULL SETTLEMENTS */

  // make iterable from iterator
  const pulledSettlements = asyncIterable(strategy);

  // yield settlements
  yield* pulledSettlements;
}
