# Nevermore - Controller for async pipelines

`Nevermore` controls when async tasks are run. It has APIs for ad-hoc async
functions and for (potentially-infinite) batch async operations.

## Install

```zsh
npm install @watchable/nevermore
```

## Usage

### Ad Hoc (async function) API

An `ExecutorStrategy` can transform a normal async function into a function that
is regulated by a `nevermore` pipeline.

Create a strategy and get back a `createExecutor()` function. The strategy shown
below exercises most of the options - concurrency-limits, rate-limits, timeouts
and retries...

```ts
import { createExecutorStrategy } from "@watchable/nevermore";
const { createExecutor } = createExecutorStrategy({
  concurrency: 1,
  intervalMs: 100,
  timeoutMs: 3000,
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

For batch routines, (or potentially infinite sets), nevermore provides an
alternative API based on iterable sequences of no-arg functions, with the same
options available...

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

The type of settlements yielded by `nevermore` aligns with
[Promise.allSettled()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled),
but with an extra `job` member.

The type of your job `J` is preserved in `JobSettlement<J>`, meaning you can get
the annotations back at settlement time.

Annotating a job is trivial. Instead of ...

```ts
yield () => getStarWars(filmId);
```

Add properties with `Object.assign`

```ts
yield Object.assign(
    () => getStarWars(filmId),
    { filmId }
)
```

Then you can get the extra information back from the `job` in the settlement...

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

## Under the hood

The `nevermore` implementation accepts arbitrary pipeline stages known as
strategies. The concurrency, interval, timeout, retry strategies are already
implemented as individual composable blocks which are piped together. You can
see the available options through intellisense when invoking `createExecutor` or
`nevermore`.

The `createExecutor` primitive is built on top of `nevermore` pipelines, but
provides a simple API in which you can transparently wrap your own typed
functions to have them constrained by the pipeline.

A _**concurrency-limiting**_ `Strategy` accepts another job only when the number
of pending jobs goes below a threshold (because pending jobs have settled as
resolved or rejected). Once there is a slot for a pending job, it will accept a
new job and attempt to pass it on to the next layer.

A _**rate-limiting**_ `Strategy` accepts another job only when there is still a
slot within this interval (until the number of launches within the interval
matches `intervalLaunches`). When the limit is hit, it can work out when the
next slot will become free, and sleeps for that duration before yielding and
accepting the next job.

A _**timeout**_ `Strategy` always accepts jobs, wraps them in a timeout job that
throws an error if it hasn't settled in time before passing the task downstream.
On receiving a settlement it unwraps the timeout job, so the `JobSettlement`
points to the original job, rather than the modified one.

A _**retry**_ `Strategy` always accepts jobs, wraps them in a retry job, storing
extra metadata describing the count of retries attempted. `JobResolved`
settlements are unwrapped to create a `JobResolved` for the original job.
However `JobRejected` events are re-attempted until reaching the maximum number
of retries for that job, and then the failure is passed back down the chain.

If you wish to add e.g. a BackoffRetry or a CircuitBreaker strategy, this can
extend the richness of your pipeline. Pass your piped strategies in the `pipes`
option and they will be wired after the others specified in your options.

## See also

- p-limit
- p-queue
- p-retry
- promise-pool
