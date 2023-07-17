export type Job<T> = () => Promise<T>;

export type Sequence<T> = Iterable<T> | AsyncIterable<T>;
// | Iterator<T>
// | AsyncIterator<T>;

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

export interface Strategy<T, J extends Job<T>> {
  launches: AsyncGenerator<J>;
  settlements: AsyncGenerator<JobSettlement<T, J>>;
}

export type Nevermore<T, J extends Job<T>> = (
  jobSequence: Sequence<J>
) => AsyncIterator<JobSettlement<T, J>>;

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
