/** Job functions are called with no args, or an options object containing a
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

/** A operation that returns T. Strategies may repeat a failed operation by
 * calling it multiple times, or cancel it by allowing the cancelPromise in
 * `JobArgs` to resolve.
 */
export type Job<T> = (...args: JobArgs) => Promise<T>;

/** A record that a `Job` execution succeeded, returned a `value`. */
export interface JobFulfilment<J extends Job<unknown>> {
  job: J;
  status: "fulfilled";
  value: Awaited<ReturnType<J>>;
}

/** A record that a `Job` execution failed, threw a `reason`. */
export interface JobRejection<J extends Job<unknown>> {
  job: J;
  status: "rejected";
  reason: unknown;
}

/** Discriminated union recording either a Job's success or failure. */
export type JobSettlement<J extends Job<unknown>> =
  | JobFulfilment<J>
  | JobRejection<J>;

/** Limit pending promises (launched but not yet settled) */
export interface ConcurrencyOptions {
  /** The maximum number of pending promises allowed by the strategy.
   * `Job` execution is halted when the pending number reaches `concurrency`.
   */
  concurrency: number;
}

/** Patience before abandoning pending promises (launched but not yet settled) */
export interface TimeoutOptions {
  /** The number of milliseconds to wait before considering a Job to be failed. */
  timeoutMs: number;
}

/** A limit on job launches made within each second, (or chosen interval) */
export interface RateOptions {
  /** The length of each scheduling interval. */
  intervalMs: number;
  /** The number of jobs which can be carried out in one scheduling interval (default is 1). */
  intervalSlots?: number; // assume one job per interval
}

interface RetryOptions {
  /** The number of attempts before considering a Job to be rejected. */
  retries?: number;

  /** A predicate to determine if a thrown error should allow a retry.
   * If omitted then jobs are retried for all errors.
   */
  retryAllowed?: (error: unknown) => boolean;
}

/** Options to enable and control a BackoffStrategy.
 *
 * The delay between retries is multiplied by backoffGrowth after each failure.
 * Delay therefore has an exponent of `n` for the nth repetition.
 *
 * Delay is calculated to be approximately `backoffMs *
 * Math.pow(backoffFactorGrowth, n)`. This delay is optionally randomised by a
 * jitter factor and/or limited by an exponent ceiling.
 */
interface BackoffOptions {
  /** The delay before the first retry. Subsequent retries are scheduled by
   * multiplying this millisecond delay by a constant factor.
   *
   * There is no default value. Setting a backoffMs activates the backoff
   * strategy. If `backoffMs` is not present, no backoff strategy will be launched
   * and all other `backoffXXX` options should be omitted.
   */
  backoffMs: number;

  /** The initial multiplying factor (1.0) grows by this proportion each time.
   * By default `backoffGrowth` is 2.0 meaning the first delay is `1.0 x
   * backoffMs`, the second is `2.0 x backoffMs`, the third is `4.0 x backoffMs`
   * Set to 1.0 to eliminate exponential growth in the delay.
   * A value of less than 1.0 is considered invalid and will throw an exception.
   */
  backoffGrowth?: number;

  /** A ceiling for the backoff exponent that prevents delays becoming
   * astronomical. Default is 10 meaning the scheduled delay is constant after
   * the 10th failure. Set to `Infinity` for no limit. A value of less than 1.0
   * is considered invalid and will throw an exception.
   */
  backoffMaxExponent?: number;

  /** When scheduling an exponential delay, it is adjusted by a random jitter --
   *  a proportion of the calculated delay between `-backoffJitter` and
   *  `+backoffJitter`.
   *
   * The default is 0.1 meaning the actual delay falls between 90% and 110% of
   * the exponential delay. This helps to avoid multiple independent schedulers
   * synchronizing their retries even when the initial failures were
   * synchronized. Set to 0 for no jitter. */
  backoffJitter?: number;
}

type NothingFrom<T> = {
  [k in keyof Required<T>]?: never;
};

/** Combined options now backoff strategy also handles simple retry. */
export type BackoffRetryOptions =
  | (RetryOptions & BackoffOptions)
  | (RetryOptions & NothingFrom<BackoffOptions>)
  | (BackoffOptions & NothingFrom<RetryOptions>);

/** Allows custom strategies to be chained after built-in strategies. */
export interface PipeOptions {
  /** Pipes to be wired in after all other strategies. The pipe's launchJob()
   * implementation should wait on the downstream strategy's launchJob(). This
   * has the effect of respecting the constraints of concurrency, rate-limits
   * and other strategies configured by built-in `NevermoreOptions`. However,
   * it means that your pipe can add its own additional scheduling, job behaviours
   * or annotations.
   */
  pipes: Pipe[];
}

/** Provides a 'control-plane' Promise that downstream strategies and jobs can
 * await to know when and if they should terminate themselves. */
export interface CancelOptions {
  cancelPromise: Promise<unknown>;
}

/** Combined options for all strategies which can be piped together using
 * {@link createExecutorStrategy} or {@link createSettlementSequence}
 */
export type NevermoreOptions = Partial<
  ConcurrencyOptions &
    RateOptions &
    TimeoutOptions &
    BackoffRetryOptions &
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

/** A record of a launch, combining the Job (async function) and the
 * resulting Promise.
 */
export interface Launch<J extends Job<unknown>> {
  job: J;
  promise: Promise<Awaited<ReturnType<J>>>;
}

/** A generic factory signature binding a Job type to a Strategy. */
export type StrategyFactory = <J extends Job<unknown>>() => Strategy<J>;

/** A `Pipe` consumes a `StrategyFactory` and creates a derived
 * `StrategyFactory`. This provides a useful formalism for chaining strategies,
 * exercising the generic `Job` signature of `StrategyFactory`.
 *
 * The Pipe API having both upstream and downstream StrategyFactory signatures
 * means the caller (which is often another pipe) dictates the Job type of the
 * eventual upstream Strategy, while the pipe itself controls the Job type of
 * the eventual downstream Strategy, (based on the upstream type).
 *
 * For example, a timeout Pipe or retry Pipe wraps an original Job in a
 * TimeoutJob or RetryJob - adding extra properties and behaviour. Wiring in
 * each strategy therefore changes the downstream job type, leading to
 * strategies having jobs like `RetryJob<TimeoutJob<J>>` given an original job
 * J.
 */
export type Pipe = (
  createDownstreamStrategy: StrategyFactory
) => StrategyFactory;
