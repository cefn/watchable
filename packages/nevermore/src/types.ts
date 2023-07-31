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

export interface JobResolution<T, J extends Job<T>> {
  job: J;
  kind: "resolved";
  value: T;
}

export interface JobRejection<T, J extends Job<T>> {
  job: J;
  kind: "rejected";
  error: unknown;
}

export type JobSettlement<T, J extends Job<T>> =
  | JobResolution<T, J>
  | JobRejection<T, J>;

/** A limit on the number of pending promises (created but not yet settled) */
export interface ConcurrencyOptions {
  concurrency: number;
}

/** A limit on the number of pending promises (created but not yet settled) */
export interface TimeoutOptions {
  timeoutMs: number;
}

/** A limit on the number of promises created within a millisecond interval */
export interface RateOptions {
  rateLimit: number;
  rateIntervalMs: number;
}

export interface RetryOptions {
  retries: number;
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
  AllOrNothing<RateOptions> &
  AllOrNothing<RateOptions>;

export type LimitOptions = AnyOptions & OnePropertyFrom<AnyOptions>;

// TODO `launches` should track a uniquely-identified object per launch
// since the job could be re-used, but the launch request is unique
// maps could use the launch itself or an auto-incrementing id as a key
// to manage launch records?
// TODO rename to Feed ?
export interface Primitive<T, J extends Job<T>> {
  launches: AsyncGenerator<J>;
  settlements: AsyncGenerator<JobSettlement<T, J>>;
}

/** Infers the yielded value from a generator type */
export type GYielded<G extends Generator> = G extends Generator<infer yielded>
  ? yielded
  : never;

/** Infers the next() argument from a generator type */
export type GReturned<G extends Generator> = G extends Generator<
  any,
  infer returned
>
  ? returned
  : never;

/** Infers the returned value from a generator type */
export type GNexted<G extends Generator> = G extends Generator<
  any,
  any,
  infer nexted
>
  ? nexted
  : never;
