import type { Job, JobSettlement, NevermoreOptions, Pipe } from "./types";
import { createSettlerStrategy } from "./strategies/settler";
import {
  createConcurrencyPipe,
  validateConcurrency,
} from "./strategies/concurrency";
import { createFinalizerPipe } from "./strategies/finalizer";
import { asyncIterable } from "./util";

/** Sequence the pipes (strategy wrappers) specified by caller. */
function* pipesFromOptions(
  options: NevermoreOptions & {
    pipes?: Pipe[];
  }
) {
  if (validateConcurrency(options, { throwError: true })) {
    // limit number of simultaneously pending promises
    yield createConcurrencyPipe(options);
  }
  // wire pipes passed by caller before finalizing
  if (typeof options.pipes !== "undefined") {
    yield* options.pipes;
  }
  // finalizer tracks events, notifies when sequence is done
  yield createFinalizerPipe();
}

/**
 * @param jobs An array, generator or other Iterable. Nevermore will pull jobs from it just-in-time.
 * @param options.cancelPromise If provided, Nevermore will cease launching jobs whenever this promise settles.
 * @returns
 */
export async function* nevermore<T, J extends Job<T>>(
  options: NevermoreOptions & {
    pipes?: Pipe[];
  },
  jobs:
    | Iterable<J>
    | AsyncIterable<J>
    | (() => Generator<J>)
    | (() => AsyncGenerator<J>)
): AsyncIterable<JobSettlement<T, J>> {
  const { cancelPromise } = options;

  /** COMPOSE STRATEGY */

  // define a factory that creates a settler strategy
  // (a strategy that attempts to immediately settle every job)
  let createStrategy = <T, J extends Job<T>>() =>
    createSettlerStrategy<T, J>(cancelPromise);

  // compose further factories specified by caller (wrapping settler factory)
  for (const pipe of pipesFromOptions(options)) {
    createStrategy = pipe(createStrategy);
  }

  // execute all wrapped factories, creating a composed strategy
  const strategy = createStrategy<T, J>();

  /** PUSH JOBS */

  // if jobs is a generator function, create an iterable from it
  const jobIterable =
    Symbol.iterator in jobs || Symbol.asyncIterator in jobs ? jobs : jobs();

  // push jobs into strategy as fast as possible
  async function pushJobs() {
    try {
      // prime the generator (progress to the first yield)
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
