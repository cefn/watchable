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

export interface JobFulfilment<T, J extends Job<T>> {
  job: J;
  status: "fulfilled";
  value: T;
}

export interface JobRejection<T, J extends Job<T>> {
  job: J;
  status: "rejected";
  reason: unknown;
}

export type JobSettlement<T, J extends Job<T>> =
  | JobFulfilment<T, J>
  | JobRejection<T, J>;

/** Limit pending promises (launched but not yet settled) */
export interface ConcurrencyOptions {
  concurrency: number;
}

/** Patience before abandoning pending promises (launched but not yet settled) */
export interface TimeoutOptions {
  timeoutMs: number;
}

/** A limit on job launches made within each second, (or chosen interval) */
export interface IntervalOptions {
  intervalLaunches: number;
  intervalMs?: number;
}

export interface RetryOptions {
  retries: number;
}

export interface CancelOptions {
  cancelPromise: Promise<unknown>;
}

/** Require a type's properties to be either fully present, or fully absent */
type AllOrNothing<T> =
  | T
  | {
      [k in keyof Required<T>]?: never;
    };

/** Require at least one assigned property from T */
type OnePropertyFrom<T> = {
  [K in keyof T]: Pick<Required<T>, K>;
}[keyof T];

/** Presence and absence of all configs (implicitly includes case of no limits) */
type AnyOptions = AllOrNothing<ConcurrencyOptions> &
  AllOrNothing<TimeoutOptions> &
  AllOrNothing<IntervalOptions> &
  AllOrNothing<RetryOptions> &
  AllOrNothing<CancelOptions>;

export type NevermoreOptions = AnyOptions & OnePropertyFrom<AnyOptions>;

export type LaunchesGenerator<T, J extends Job<T>> = AsyncGenerator<
  void,
  void,
  J
>;

export type SettlementsGenerator<T, J extends Job<T>> = AsyncGenerator<
  JobSettlement<T, J>,
  void,
  void
>;

// TODO `launches` should track a uniquely-identified object per launch
// since the job could be re-used, but the launch request is unique
// maps could use the launch itself or an auto-incrementing id as a key
// to manage launch records?
export interface Strategy<T, J extends Job<T>> {
  launches: LaunchesGenerator<T, J>;
  settlements: SettlementsGenerator<T, J>;
}

/** Function defining a Generic binding for a Strategy
 * (facilitating inference from its outputs) */
export type StrategyFactory = <T, J extends Job<T>>() => Strategy<T, J>;

/** Formalism for composing strategies that wire to each other. Allows for the
 * fact the upstream strategy needs to dictate the downstream Job<T> type (e.g.
 * TimeoutStrategy, RetryStrategy wrap jobs). Factory-wrapper
 * approach avoids polluting the signature with strategy-specific parameters.
 */
export type Pipe = (
  createDownstreamStrategy: StrategyFactory
) => StrategyFactory;

/** Infers the yielded value from a generator type */
export type Yielded<I extends Iterator<unknown>> = I extends Iterator<
  infer yielded
>
  ? yielded
  : never;

/** Infers the next() argument from a generator type */
export type Returned<I extends Iterator<unknown>> = I extends Iterator<
  any,
  infer returned
>
  ? returned
  : never;

/** Infers the returned value from a generator type */
export type Nexted<I extends Iterator<unknown>> = I extends Iterator<
  any,
  any,
  infer nexted
>
  ? nexted
  : never;

/** From https://github.com/piotrwitek/utility-types/blob/411e83ecf70e428b529fc2a09a49519e8f36c8fa/src/mapped-types.ts#L630 */
export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;
