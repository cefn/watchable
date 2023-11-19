Nevermore provides a simple, generator-based interface turning a sequence of
async functions (provided by the caller) into a sequence of settlements
finalising the result of each job as `"resolved"` or `"rejected"`.

Sequences of async functions can be...

- an array of async functions
- an iterator of async functions
- an iterable returning an iterator of async functions

## Simple Usage - Concurrency

With a `fetchOk` function that returns the body from a status 200 response, you
could get the first three Star Wars films, being kind to the SWAPI servers -
with at most one outstanding request at a time...

```ts
// with an array
const settlementSequence = nevermore({ concurrency: 1 }, [
  () => fetchOk("https://swapi.dev/api/films/1/"),
  () => fetchOk("https://swapi.dev/api/films/2/"),
  () => fetchOk("https://swapi.dev/api/films/3/"),
]);

// with a no-arg generator
const settlementSequence = nevermore({ concurrency: 1 }, function* () {
  let filmNumber = 1;
  do {
    yield () => fetchOk(`https://swapi.dev/api/films/${filmNumber}/`);
    filmNumber++;
  } while (filmNumber < 4);
});
```

To consume the results as they are settled...

```ts
for await (const settlement of settlementSequence) {
  if (settlement.kind === "resolved") {
    console.log(`Succeeded. Record : ${settlement.value}`);
  } else {
    console.err(`Failed. Error message: ${settlement.error?.message}`);
  }
}
```

## Job Annotation for Control and Reporting

A `nevermore` `Job<T>` is an async function (a factory for a `Promise<T>`).
However its signature can be extended with extra metadata to help job control
and reporting.

In our Star Wars example, we may need to report _**which**_ Star Wars film
failed to be retrieved. To enable this improved reporting, we extend the type of
the job yielded by our generator.

```ts
const settlementSequence = nevermore({ concurrency: 1 }, function* () {
  let filmNumber = 1;
  do {
    yield Object.assign(
      () => fetchOk(`https://swapi.dev/api/films/${filmNumber}/`),
      { filmNumber }
    );
    filmNumber++;
  } while (filmNumber < 4);
});
```

Using `Object.assign` to attach the property `filmNumber` extends the job type
yielded by our generator. We can then read the type-safe `filmNumber` from the
job when we consume the settlements, improving our reporting.

```ts
for await (const settlement of settlementSequence) {
  const { filmNumber } = settlement.job;
  if (settlement.kind === "resolved") {
    console.log(`${filmNumber} record : ${settlement.value}`);
  } else {
    console.err(`${filmNumber} error message : ${settlement.error?.message}`);
  }
}
```

## Power Usage - Rate Limiting, Timeout, Retry,

Using `concurrency` limits to only N pending task at a time puts a ceiling on
resources used by parallel requests. However, there are many more constraints
that may be needed. The real power of `nevermore` comes when combining multiple
constraints on the flow of async tasks...

- Interval: An API often rate-limits clients, rejecting their requests if they
  make more than a certain number within an interval. Limiting tasks with an
  `intervalCount` restricts how many request are made per second. Optionally
  providing an `intervalMs` changes the interval length over which the count is
  made.
- Timeout: If the SWAPI request sometimes hangs and liveness is important to
  your app you don't want to wait forever. You can opt in to a timeout strategy
  to give up on requests that respond too slowly.
- Retry: If the SWAPI request occasionally fails or times out, you can re-run
  the job several times with a retry strategy.

All of the above can be achieve through the same minimal signature as we saw
with `concurrency` like this...

```ts
const settlementSequence = nevermore(
  { concurrency: 2, intervalLaunches: 2, retries: 3, timeoutMs: 3000 },
  function* () {
    let filmNumber = 1;
    do {
      yield () => fetchOk(`https://swapi.dev/api/films/${filmNumber}/`);
      filmNumber++;
    } while (filmNumber < 4);
  }
);
```

## Implementation, Extension

Internally, Nevermore is implemented using layered `Feeds`. Each `Feed` imposes
constraints on earlier `Feeds` through the implementation of its `launches` and
`settlements` generators.

Both `launches` and `settlements` are async coroutines, fed and consumed by the
next `Feed` in the sequence. The last `Feed` in the sequence controls the
eventual Promise `JobSettlement` events served to the caller.

Strategies are all layered on top of 'SourceFeed'. This is a simple strategy
which immediately runs every job passed via `launches.next(job)`, creating a
Promise. It tracks the Promise's eventual outcome, yielding it as a
`JobSettlement` via `settlements.next()`.

A strategy layered on top of the SourceFeed can intercept jobs and prevent them
from being launched until the strategy allows. They can also couple their
`launches` to the results of `settlements`, for example tracking the count of
unsettled jobs and the timing of pending jobs. In turn further strategies can be
layered on top. New `Feed` strategies following this pattern can be added by
users.

### Mechanism: `launches` and `settlements`

Each `Feed`'s async `launches` coroutine accepts a job via `.next(job)`. This
approach effectively pulls through jobs created 'just in time' from a
(potentially infinite) sequence provided by the caller.

The `Feed` can choose when and how to pass a job on to the `launches` of a
`Feed` in the layer below, potentially transforming the job on the way. It can
decide when to yield back to the caller and accept the next job. In this way
launches can be constrained and transformed by lots of different strategies.

Crucially the `Feed` can also couple its manipulation of `launches` to its
implementation of `settlements` co-routine (which notifies the eventual outcome
of jobs launched by lower Feeds).

### Worked Examples

A _**concurrency-limiting**_ `Feed` accepts another job only when the number of
pending jobs goes below a threshold (because pending jobs have settled as
resolved or rejected). Once there is a slot for a pending job, it will accept a
new job and attempt to pass it on to the next layer.

A _**rate-limiting**_ `Feed` accepts another job only when there is still a slot
within this interval (until the number of launches within the interval matches
`intervalLaunches`). When the limit is hit, it can work out when the next slot
will become free, and sleeps for that duration.

A _**timeout**_ `Feed` always accepts jobs and passes them on immediately.
However it passes on a modified job to the next layer that throws an error if it
hasn't settled in time. It unwraps settlements, making sure that the yielded
`JobSettlement` points to the original job, rather than the modified one.

A _**retry**_ `Feed` always accepts jobs and passes them on immediately, and
always yields `JobSettlements` directly back when they are of kind `'resolved'`.
However `JobSettlements` with kind `'rejected'` will cause it to

### Reference 'Identity' Feed Implementation

The 'Identity' feed imagined below, could be layered on top of any feed and
would transparently pass jobs and settlements. More specialised feeds are based
on these coroutines, but with additional logic as jobs and settlements pass
through them.

```ts
export function createIdentityFeed<T, J extends Job<T>>(feed: Feed<T, J>) {
  async function* createLaunchSequence() {
    let value: undefined | GYielded<typeof field.launches> = undefined;
    for (;;) {
      const job = yield value;
      const result = await feed.launches.next(job);
      if (result.done) {
        return result.value;
      }
      ({ value } = result);
    }
  }

  async function* createSettlementSequence() {
    for await (const settlement of feed.settlements) {
      yield settlement;
    }
  }

  const launches = createLaunchSequence();
  const settlements = createSettlementSequence();

  return {
    launches,
    settlements,
  };
}
```
