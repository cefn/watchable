# nevermore - limit the execution of async functions

## What is nevermore?

The `nevermore` scheduler can wraps your async functions to impose
rate-limiting, concurrency control, retry, backoff, timeout without changing
their signature.

It can also regulate tasks as part of potentially infinite batch processes with
backpressure to limit the growth of memory in your app.

The execution of Jobs is controlled through composable scheduling primitives
known as strategies. Multiple strategies are already implemented as individual
composable blocks which can be freely combined. You can further extend nevermore
by writing your own strategies.

## Usage

You can select strategies by passing option values to one of the two core
nevermore APIs...

```ts
import { createExecutorStrategy } from "@watchable/nevermore";
import { myFn } from "./myFn.ts";

const { createExecutor } = createExecutorStrategy({
  concurrency: 1,
  intervalMs: 100,
  timeoutMs: 3000,
  retries: 3,
});

const myLimitedFn = createExecutor(myFn);
```

`nevermore` has two core APIs which accept the same strategy options...

- `createExecutorStrategy` - wraps async functions without changing your code
- `createSettlementSequence` - pulls from generators creating jobs just-in-time

See more detail about the two API signatures in the `APIs` section later in this
document.

## Available strategies

A _**concurrency**_ `Strategy` accepts another job only when the number of
pending jobs goes below `concurrency`. When there is a free slot (previously
pending jobs have settled as resolved or rejected), the strategy will accept a
new pending job. To activate this strategy, provide a `concurrency` number in
the options.

A _**rate**_ `Strategy` implements rate limiting by launching the next job only
when there is a free slot within the `intervalMs`. Every execution of a job uses
up one slot in the interval. When an interval's slots are exhausted, the
strategy calculates when the next slot will become free, and sleeps for that
duration before accepting the next job. To activate this strategy, provide an
`intervalMs` number in the options. The default value of `intervalLaunches` is
`1` launch per interval.

A _**timeout**_ `Strategy` always accepts jobs, wraps them in a timeout job
(that throws an error if the job hasn't settled before `timeoutMs`) before
passing the job to downstream strategies. On receiving a settlement (fulfilment,
rejection or timeout) it unwraps the timeout job, yielding a `JobSettlement`
pointing to the original job, not the substitute. To activate this strategy,
provide a `timeoutMs` number in the options and remember your wrapped function
may now throw a nevermore `TimeoutError`.

A _**retry**_ `Strategy` repeatedly calls failing jobs until the number of
failures equals `retries`. It wraps jobs in a retry job before launching them,
storing the count of retries attempted. `JobResolved` settlements are unwrapped
yielding a `JobResolved` pointing to the original job. By contrast,
`JobRejected` events trigger further retries until reaching the maximum number
of retries for that job, and the last failure is passed back as the job's
settlement. To activate this strategy, provide a `retries` number in the
options.

A _**backoff**_ `Strategy` repeatedly calls failing jobs with a increasing
backoff delay (based on an exponential function). See the section on 'retry' for
more detail of the approach. To activate this strategy, provide a `backoffMs`
number in the options. To get eventual feedback from continually failing jobs,
you need to set a `retries` option. To get backpressure from
`createSettlementSequence` pulling just-in-time, you need to set a `concurrency`
option to prevent indefinitely-many jobs being queued.

## Install

```zsh
npm install @watchable/nevermore
```

## APIs

### Ad Hoc (async function) API

An `ExecutorStrategy` can transform a normal async function into a function that
is regulated by a `nevermore` pipeline.

Create a strategy and get back a `createExecutor()` function. The strategy shown
below exercises most of the options - concurrency-limits, rate-limits, backoff,
timeouts and retries...

```ts
import { createExecutorStrategy } from "@watchable/nevermore";
const { createExecutor } = createExecutorStrategy({
  concurrency: 1,
  intervalMs: 100,
  timeoutMs: 3000,
  backoffMs: 1000,
  retries: 3,
});
```

You can then use `createExecutor` to turn an ordinary function into a regulated
function that respects the constraints of the strategy you configured...

```ts
async function getStarWars(filmId: number) {
  return await fetch(`https://swapi.dev/api/films/${filmId}/`, {
    method: "get",
  });
}

const getStarWarsExecutor = createExecutor(getStarWars);

// the below invocation has intellisense for
// autocompleting args for getStarWars and...
// * will allow only one concurrent retrieval
// * will allow only one retrieval every 100ms
// * will timeout individual attempts after 3000ms
// * will attempt up to 3 times if getStarWars throws
const [episode4, episode5, episode6] = await Promise.allSettled([
  getStarWarsExecutor(1),
  getStarWarsExecutor(2),
  getStarWarsExecutor(3),
]);
```

### Batch (generator) API

For batch routines, (or potentially infinite sets), `createSettlementSequence`
provides an alternative API based on iterable sequences of callbacks of a
generic type you define.

Exactly the same scheduling options (`concurrency`, `retry` etc.) are supported
as in the `createExecutorStrategy` API.

#### Explanation

If you eventually need to satisfy a million requests, you don't want to spawn
them all as pending promises in memory while they are slowly processed at 100
per second. The resources dedicated to pending jobs should be allocated
just-in-time.

The `createExecutor` approach described above is very convenient for adding
seamless scheduling of hundreds of parallel tasks without having to change your
code. Unfortunately this makes the scheduling opaque and there is therefore no
mechanism to provide backpressure when jobs aren't completing quickly.

By contrast the `createSettlementSequence` allows developers to respect
'backpressure' from a pipeline's limited capacity. Each `Job` is yielded from
your iterator just-in-time as capacity becomes available. Between yields your
iterator is halted, holding only its stack in memory. An iteration procedure for
1 million requests will therefore only progress as fast as the pipeline allows,
and the only promises in memory are those which have been scheduled.

An example of a sequence yielding `Job` callbacks one-by-one is shown below.

```ts
import { createSettlementSequence } from "@watchable/nevermore";

// define a sequence of zero-arg functions
async function* createJobSequence() {
  for (;;) {
    yield () => {
      const result = await fetch(
        `https://timeapi.io/api/TimeZone/zone?timeZone=Europe/London`
      );
      if (result.status !== 200) {
        throw new Error("Failure retrieving time");
      }
      return result.json() as { timeZone: string; currentLocalTime: string };
    };
  }
}

// create a sequence of settlements (limited by specified options)
const settlementSequence = createSettlementSequence(
  {
    concurrency: 1,
    intervalMs: 1000,
    timeoutMs: 3000,
    retries: 3,
  },
  createJobSequence
);

// consume the settlements (like Promise.allSettled())
for await (const settlement of settlementSequence) {
  if (settlement.status === "fulfilled") {
    console.log(`Time in London is ${settlement.value.currentLocalTime}`);
  } else {
    console.error(
      `Gave up retrying. Last error was: ${settlement.reason?.message}`
    );
  }
}
```

#### Extending Settlement

The type of settlements yielded from a settlement sequence aligns with
[Promise.allSettled()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled),
but with an extra `job` member.

The type of your job `J` is preserved in `JobSettlement<J>`, meaning you can get
the annotations back at settlement time.

Annotating a job, and creating an inferrable `J` is trivial. Instead of ...

```ts
yield () => getStarWars(filmId);
```

Add properties to the yielded no-arg function with `Object.assign`

```ts
yield Object.assign(() => getStarWars(filmId), { filmId });
```

Then you can get the extra information back from the type-safe `job` in the
settlement...

```ts
// consume the settlements (like Promise.allSettled())
for await (const settlement of settlementSequence) {
  const { filmId } = settlement.job;
  if (settlement.status === "fulfilled") {
    console.log(`Success for ${filmId} : response was ${settlement.value}`);
  } else {
    console.error(
      `Failure for ${filmId}: last error was ${settlement.reason?.message}`
    );
  }
}
```

## Writing your own `nevermore` strategies

Developers can add e.g. a CircuitBreaker strategy of their own to extend the
richness of their nevermore pipeline.

For reference a _**passthru**_ `Strategy` is included in source. This is a no-op
strategy that is suitable as a starting point for your own strategies. Its
implementation is shown in full below to illustrate the `Strategy` formalism.

- `launchJob()` asks to schedule a `Job`, returning a promise that resolves once
  the job has been first invoked.
- `launchesDone()` is a signal called on your strategy when no further launches
  will take place, allowing it to track remaining pending jobs, and finally
  clean up resources.
- `next(): Promise<IteratorResult<JobSettlement<J>>>` implements an
  `AsyncIterator` allowing your strategy to pass back the eventual settlements
  of launched jobs (when they are eventually fulfilled or rejected).

```ts
export function createPassthruStrategy<J extends Job<unknown>>(
  downstream: Strategy<J>
) {
  return {
    launchJob(job) {
      return downstream.launchJob(job);
    },
    launchesDone() {
      downstream.launchesDone();
    },
    next() {
      return downstream.next();
    },
  } satisfies Strategy<J>;
}
```

## Changing strategy sequence

You can pass piped strategies in the `pipes` option to be placed upstream of
strategies specified in the other options. If there are no other options, it
will simply sequence the pipes you choose. `nevermore` exports factories for
core pipes using e.g. as `createConcurrencyPipe()` and `createTimeoutPipe()`.

This would be needed if you want to sequence your own strategies differently
than the default sequence (found in the core `sequence.ts` file). For example,
in the default sequence backoff is placed before concurrency. This ensures that
backed off tasks don't consuming a slot except when they are re-executing, and
avoids blocking other tasks from executing. If you want a concurrency slot to be
dedicated to a task during its whole backoff lifecycle, you can place
concurrency before backoff.

## See also

- p-limit
- p-queue
- p-retry
- promise-pool
