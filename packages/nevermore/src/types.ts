/** Job functions are called with no args, or an object containing a
 * `cancelPromise`. If the underlying async operation doesn't support
 * cancellation, the cancelPromise argument can be ignored. If the job is
 * cancellable, (such as a fetch which has support for AbortSignal) the
 * underlying operation should be aborted when the cancelPromise resolves. In
 * normal operation, the cancelPromise will remain permanently unsettled.
 */
export type JobArgs =
  | []
  | [
      {
        cancelPromise: Promise<unknown>;
      }
    ];

export type Job<T> = (...args: JobArgs) => Promise<T>;

export interface JobFulfilment<J extends Job<unknown>> {
  job: J;
  status: "fulfilled";
  value: Awaited<ReturnType<J>>;
}

export interface JobRejection<J extends Job<unknown>> {
  job: J;
  status: "rejected";
  reason: unknown;
}

export type JobSettlement<J extends Job<unknown>> =
  | JobFulfilment<J>
  | JobRejection<J>;

/** Limit pending promises (launched but not yet settled) */
export interface ConcurrencyOptions {
  concurrency: number;
}

/** Patience before abandoning pending promises (launched but not yet settled) */
export interface TimeoutOptions {
  timeoutMs: number;
}

/** A limit on job launches made within each second, (or chosen interval) */
export interface RateOptions {
  intervalSlots?: number; // assume one job per interval
  intervalMs: number;
}

export interface RetryOptions {
  retries: number;
}

export interface PipeOptions {
  pipes: Pipe[];
}

export interface CancelOptions {
  cancelPromise: Promise<unknown>;
}

export type NevermoreOptions = Partial<
  ConcurrencyOptions &
    RateOptions &
    TimeoutOptions &
    RetryOptions &
    CancelOptions &
    PipeOptions
>;

// TODO `launches` should track a uniquely-identified object per launch
// since the job could be re-used, but the launch request is unique
// maps could use the launch itself or an auto-incrementing id as a key
// to manage launch records?
export type Strategy<J extends Job<unknown>> = AsyncIterator<
  JobSettlement<J>
> & {
  launchJob: (job: J) => Promise<void>;
  launchesDone: () => void;
};

export interface Launch<J extends Job<unknown>> {
  job: J;
  promise: Promise<Awaited<ReturnType<J>>>;
}

/** Function defining a Generic binding for a Strategy
 * (facilitating inference from its outputs) */
export type StrategyFactory = <J extends Job<unknown>>() => Strategy<J>;

/** Formalism for composing strategies that wire to each other. Allows for the
 * fact the upstream strategy needs to dictate the downstream Job<T> type (e.g.
 * TimeoutStrategy, RetryStrategy wrap jobs). Factory-wrapper
 * approach avoids polluting the signature with strategy-specific parameters.
 */
export type Pipe = (
  createDownstreamStrategy: StrategyFactory
) => StrategyFactory;
