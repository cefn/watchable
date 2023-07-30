# Nevermore - Limit-Pipeline Design

Nevermore uses Generators and AsyncGenerators to define behaviour of a pipeline
of async jobs, with the following mechanisms...

## Summary

Pipelining async results...

- Job functions return a promise of the eventual result
- Job functions can include per-job metadata for callers to debug promise
  settlement
- Pipeline capacity determines when to create and execute the next async job
  function from a sequence
- Pipeline can intercept results and execute the job function multiple times in
  sequence until it succeeds

Limit pipeline primitives are provided for...

- Concurrency
- Rate Limit
- Timeout
- Retry

## Detail

Nevermore iterates over a `createJobSequence` `Iterable` provided by the caller.
It pulls the next async `Job` function (used to create an async result) on a
just-in-time basis. The caller can generate the same `Job` function multiple
times, or a new function can be created for each result, depending on their
use-case.

Nevermore produces a `ResultSequence` notifying success or failure including a
reference to the originating `Job` for that result.

`Jobs` are simple async functions typed and owned by the caller. The Job type is
a Generic meaning it can be extended and annotated in any way. For example
`config` could be a property on `Job`. This helps the caller make sense of
failures from any particular async result.

Providing `Job` functions from a generator allows you to respond to unfolding
events. You can notify job creation or completion for your own debugging. You
can keep variables in scope to dynamically vary job behaviour (e.g. use a
secondary server for all subsequent jobs when any job experiences a failure of
the primary).

# Flow-Primitives

Job flow-control primitives have a common signature and a consistent 'chain'
relationship with each other, exchanging flow-control through co-routines.

The nevermore function composes the first primitive using the iterable of job
functions provided by the caller. It selectively wires additional job primitives
into the chain according to the limit parameters provided. The final primitive
in the chain is wired as an output to notify the caller of the final success or
failure of each iterated job.

Chain primitives facilitate the following...

- lazy job creation and launch
  - each link in the chain consumes a `launches` iterator from its predecessor
  - it calls `launches.next()` when lazy-creation-and-launch of a job is needed
- settlement tracking
  - since job launches are initiated by the pipeline, it can understand how many
    unsettled promises there are, and track the success or failure of the
    promises

# Example Flow-Primitive Behaviours

# Timeout

A timeout primitive intercepts created promises, wrapping them in a Promise.race
that will resolve to failure after a setTimeout executes. Later primitives in
the chain are then prompted to re-execute within provided retry, concurrency and
rate-limits.

# Retry

A retry primitive passes on successes, but intercepts failures. It schedules the
repeated invocation of failed job functions creating new promises until that job
succeeds or an attempt count is reached.

## Concurrency

A concurrency primitive tracks and limits the count of unsettled job promises
made by job functions. When a job succeeds or fails it decrements the unsettled
count and pulls through another job from the caller-provided job sequence.

## Rate Limit

A rate limit primitive tracks how many new job promises were created in the
current interval. It pauses the creation of new job promises when the occupancy
exceeds a count and schedules when to resume creation of job promises when the
interval has spare occupancy again.

# Use of `cancelPromise`

Nevermore may be invoked with a `cancelPromise`. When this promise resolves, all
tasks and iteration should be abandoned. Internally to neverMore, promises are
combined in a `Promise.race()` with the `cancelPromise` allowing operations to
be abandoned at any time.

Jobs are passed the `cancelPromise` if one was provided. If a job triggers async
operations that have cancel support, it should wire the cancelPromise to an
abort behaviour. For example, this allows us to take advantage of the
`AbortController` support provided by the `fetch` API, e.g. ...

```ts
const { signal, abort } = new AbortController();
fetch(url, { signal });
cancelPromise.then(abort);
```

The caller is expected to leave it unsettled if jobs should continue to be
launched and results iterated.
