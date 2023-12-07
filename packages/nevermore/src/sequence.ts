import {
  createConcurrencyPipe,
  isConcurrencyOptions,
} from "./strategies/concurrency";
import { createLauncherStrategy } from "./strategies/launcher";
import { createRatePipe, isRateOptions } from "./strategies/rate";
import { createRetryPipe, isRetryOptions } from "./strategies/retry";
import { createTimeoutPipe, isTimeoutOptions } from "./strategies/timeout";
import type {
  Job,
  JobSettlement,
  NevermoreOptions,
  Pipe,
  PipeOptions,
} from "./types";
import { asyncIterable } from "./util";

function isPipeOptions(options: NevermoreOptions): options is PipeOptions {
  return typeof options.pipes !== "undefined";
}

/** Create strategies from the provided options. For each behaviour this curries
 * the behaviour-specific options into a generic Pipe interface. The Pipe
 * composition pattern allows the Job of the downstream factory to be dynamically
 * decided. For example a `TimeoutStrategy` needs a downstream strategy that
 * accepts `TimeoutJob<J>` not just `J`. And if you compose a RetryStrategy
 * before that in the sequence, then downstream it should be
 * `RetryJob<TimeoutJob<J>>`.
 *
 * @param options The combined options for all behaviours needed in the pipeline.
 * @returns an Iterable that defines the sequence of pipes opted into by the caller.
 */
function* pipesFromOptions(options: NevermoreOptions): Iterable<Pipe> {
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

/**
 * Combines the option parsing, Pipe creation routines to
 * compose a pipe. The pipe will always have a LauncherStrategy
 * (that triggers and tracks the jobs) but can have arbitrary
 * Strategies layed on top according to the options.
 *
 * @param options The combined options for all behaviours needed in the pipeline.
 * @returns The combined strategy, ready to accept jobs
 */
export function createStrategyFromOptions<J extends Job<unknown>>(
  options: NevermoreOptions
) {
  const { cancelPromise } = options;
  /** COMPOSE STRATEGY */

  // Initial factory is a launcher that immediately launches every job passed to it.
  // It tracks launched jobs, and passed back their settlements.
  // It ends settlements sequence when job sequence is finished and all jobs are settled
  let createStrategy = <J extends Job<unknown>>() =>
    createLauncherStrategy<J>(cancelPromise);

  // wrap each factory in further factories specified by caller
  for (const pipe of pipesFromOptions(options)) {
    createStrategy = pipe(createStrategy);
  }

  // execute final factory, creating a composed strategy
  return createStrategy<J>();
}

/**
 * Creates an `AsyncIterable` of `JobSettlement<J>` from a sequence of jobs `J`
 * that you provide. It will manage the launching and tracking of your jobs
 * within the (e.g. concurrency, interval, timeout, retry) constraints defined
 * by your options.
 *
 * Consume the resulting AsyncIterable with `for await...of sequence` or `await
 * sequence.next()` to get the next settlement.
 *
 * A `JobSettlement<J>` is equivalent to the values returned by
 * `Promise.allSettled()`. It will have either `status:"fulfilled",
 * value:Awaited<ReturnType<J>>` or `status:"rejected", reason:unknown`.
 * However, it has an additional typed member `job:J` referencing the job which
 * is being settled. You can add arbitrary annotations to your jobs that will
 * help you when consuming settlements.
 *
 * @param jobSequence An array, generator or other Iterable. Nevermore will pull
 * jobs from it just-in-time.
 * @param options The combined options for all behaviours needed in the
 * pipeline.
 * @returns AsyncIterable sequence of JobSettlement<J> values.
 */
export async function* createSettlementSequence<J extends Job<unknown>>(
  options: NevermoreOptions,
  jobSequence:
    | Iterable<J>
    | AsyncIterable<J>
    | (() => Generator<J>)
    | (() => AsyncGenerator<J>)
): AsyncIterable<JobSettlement<J>> {
  const strategy = createStrategyFromOptions<J>(options);

  /** PUSH JOBS */

  // if jobs is a generator function, create an iterable from it
  const jobIterable =
    Symbol.iterator in jobSequence || Symbol.asyncIterator in jobSequence
      ? jobSequence
      : jobSequence();

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
