import type { Job, JobSettlement, NevermoreOptions, Pipe } from "./types";
import { createSettlerStrategy } from "./strategies/settler";
import {
  createConcurrencyPipe,
  isConcurrencyOptions,
} from "./strategies/concurrency";
import { createFinalizerPipe } from "./strategies/finalizer";
import { asyncIterable } from "./util";
import {
  createRatePipe,
  createRetryPipe,
  isRateOptions,
  isRetryOptions,
} from ".";

/** Sequence the pipes (strategy wrappers) specified by caller. */
function* pipesFromOptions(
  options: NevermoreOptions & {
    pipes?: Pipe[];
  }
) {
  if (isRateOptions(options)) {
    // constrain jobs launched within an interval
    yield createRatePipe(options);
  }
  if (isRetryOptions(options)) {
    // repeat failing jobs a certain number of times
    yield createRetryPipe(options);
  }
  if (isConcurrencyOptions(options)) {
    // limit number of simultaneously running jobs
    yield createConcurrencyPipe(options);
  }
  // if (isTimeoutOptions(options)) {
  //   // give up on slow jobs
  //   yield createTimeoutPipe(options);
  // }
  // wire pipes passed by caller
  if (typeof options.pipes !== "undefined") {
    yield* options.pipes;
  }
  // track launched jobs, end settlements when all jobs are settled
  yield createFinalizerPipe();
}

/**
 * @param jobs An array, generator or other Iterable. Nevermore will pull jobs from it just-in-time.
 * @param options.cancelPromise If provided, Nevermore will cease launching jobs whenever this promise settles.
 * @returns
 */
export async function* nevermore<J extends Job<unknown>>(
  options: NevermoreOptions & {
    pipes?: Pipe[];
  },
  jobs:
    | Iterable<J>
    | AsyncIterable<J>
    | (() => Generator<J>)
    | (() => AsyncGenerator<J>)
): AsyncIterable<JobSettlement<J>> {
  const { cancelPromise } = options;

  /** COMPOSE STRATEGY */

  // define a factory that creates a settler strategy
  // (a strategy that attempts to immediately settle every job)
  let createStrategy = <J extends Job<unknown>>() =>
    createSettlerStrategy<J>(cancelPromise);

  // compose further factories specified by caller (wrapping settler factory)
  for (const pipe of pipesFromOptions(options)) {
    createStrategy = pipe(createStrategy);
  }

  // execute all wrapped factories, creating a composed strategy
  const strategy = createStrategy<J>();

  /** PUSH JOBS */

  // if jobs is a generator function, create an iterable from it
  const jobIterable =
    Symbol.iterator in jobs || Symbol.asyncIterator in jobs ? jobs : jobs();

  // push jobs into strategy as fast as possible
  async function pushJobs() {
    try {
      // progress generator to initial yield
      await strategy.launches.next();
      for await (const job of jobIterable) {
        await strategy.launches.next(job);
      }
    } finally {
      await strategy.launches.return();
    }
  }

  // run in background
  void pushJobs();

  /** PULL SETTLEMENTS */

  // make iterable from iterator
  const pulledSettlements = asyncIterable(strategy.settlements);

  // yield settlements
  yield* pulledSettlements;
}
