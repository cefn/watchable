Nevermore provides a simple, generator-based interface turning a sequence of
async functions (provided by the caller) into a sequence of settlements
finalising the result of each job as `"fulfilled"` or `"rejected"`.

Sequences of async functions can be...

- an array of async functions
- an iterator of async functions
- an iterable returning an iterator of async functions

## Simple Usage - Concurrency

With a `fetchOk` function that returns the body from a status 200 response, you
could get the first three Star Wars films, being kind to the SWAPI servers -
with at most one outstanding request at a time...

```ts
// with a complete array of jobs
const settlementSequence = nevermore({ concurrency: 1 }, [
  () => fetchOk("https://swapi.dev/api/films/1/"),
  () => fetchOk("https://swapi.dev/api/films/2/"),
  () => fetchOk("https://swapi.dev/api/films/3/"),
]);

// with a lazy-evaluated no-arg generator of jobs
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
  if (settlement.status === "fulfilled") {
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
we yield, adding a type-safe `filmNumber`. We can read this from the job when we
consume the settlements, improving our reporting.

```ts
for await (const settlement of settlementSequence) {
  const { filmNumber } = settlement.job;
  if (settlement.status === "fulfilled") {
    console.log(`${filmNumber} record : ${settlement.value}`);
  } else {
    console.err(`${filmNumber} error message : ${settlement.error?.message}`);
  }
}
```

## Power Users - Rate Limiting, Timeout, Retry, Backoff

Using `concurrency` limits to only N pending task at a time puts a ceiling on
resources used by parallel requests. However, there are many more constraints
that may be needed. The real power of `nevermore` comes when combining multiple
simultaneous constraints on the flow of async tasks...

- Timeout: If the SWAPI request sometimes hangs and liveness is important to
  your app you don't want to wait forever. You can opt in to a timeout strategy
  to give up on requests that respond too slowly.
- Retry: If the SWAPI request occasionally fails or times out, you can re-run
  the job several times with a retry strategy.
- Interval: An API often rate-limits clients, rejecting their requests if they
  make too many requests within an interval. Providing an `intervalMs`
  constraint ensures that only one job is triggered within that number of
  milliseconds. If the upstream API supports short periods of bursting, you can
  specify `intervalMs` in combination with an optional `intervalSlots` value to
  allow multiple jobs to be triggered immediately as long as there remains
  capacity in the interval. To stay at 100 requests per minute, a configuration
  of `{intervalMs:600}` causes 100 requests to be spaced out over the whole
  60000 milliseconds (it implies `{intervalSlots:1}`). However, if your API's
  rate-limiting window supports bursting each minute you might instead have a
  configuration `{intervalMs:60000, intervalSlots:100}`. If your service has
  been idle for some time, it can then clear 100 requests almost instantaneously
  before blocking to wait for the minute to complete.

All of the above can be achieve through a signature similar to the `concurrency`
control case, but with a handful more parameters...

```ts
const settlementSequence = nevermore(
  { concurrency: 2, intervalMs: 100, retries: 3, timeoutMs: 3000 },
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

Internally, Nevermore is implemented using layered `Strategies`. Each `Strategy`
imposes constraints on earlier `Strategies` through the implementation of its
`launches` and `settlements` generators.

Both `launches` and `settlements` are async coroutines, fed and consumed by the
next `Strategy` in the sequence. The last `Strategy` in the sequence controls
the eventual Promise `JobSettlement` events served to the caller.

Strategies are all layered on top of 'SettlerStrategy'. This is a simple
strategy which immediately runs every job passed to its `launches.next(job)`,
creating a Promise. It tracks the Promise's eventual outcome, yielding it as a
`JobSettlement` via its `settlements.next()`.

A strategy layered on top of the SettlerStrategy can intercept jobs, deciding
when to allow them to be launched, or to substitute them with modified jobs
(such as adding a timeout). They often couple their `launches` to the results of
`settlements`, for example tracking the count of unsettled jobs and the timing
of pending jobs. In turn further strategies can be layered on top. New kinds of
`Strategy` following this pattern can be added by users.

### Mechanism: `launches` and `settlements`

Each `Strategy`'s async `launches` coroutine accepts a job via `.next(job)`
which returns (yields) when the `Strategy` is ready for the next job. This
approach effectively pulls through jobs created 'just in time' from a
(potentially infinite) sequence provided by the caller.

The `Strategy` can choose when and how to pass a job on to the `launches` of a
downstream `Strategy`, potentially transforming the job on the way. It can
decide when to yield back to the caller and accept the next job. In this way
async operations can be constrained and transformed by lots of different
strategies.

Crucially the `Strategy` can also couple its manipulation of `launches` to its
implementation of `settlements` co-routine (which notifies the eventual outcome
of jobs launched by lower Strategies).

### Worked Examples

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

A _**retry**_ `Feed` always accepts jobs, wraps them in a retry job, storing
extra metadata describing the count of retries attempted. `JobResolved`
settlements are unwrapped to create a `JobResolved` for the original job.
However `JobRejected` events are re-attempted until reaching the maximum number
of retries for that job, and then the failure is passed back down the chain.

### Reference 'Identity' Feed Implementation

The 'Identity' strategy imagined below, could be layered on top of any strategy
and would transparently pass jobs and settlements. More specialised strategies
are based on these coroutines, but with additional logic as jobs and settlements
pass through them.

```ts
export function createIdentityStrategy<T, J extends Job<T>>(
  downstream: Strategy<T, J>
) {
  function* createLaunches(): AsyncGenerator<void, void, J> {
    try {
      await downstream.launches.next(); // prime generator to yield point
      for (;;) {
        const job = yield;
        const launchResult = await downstream.launches.next(job);
        if (launchResult.done === true) {
          break;
        }
      }
    } finally {
      downstream.launches.return();
    }
  }

  function* createSettlements(): AsyncGenerator<
    JobSettlement<T, J>,
    void,
    void
  > {
    try {
      const settlementResult = await downstream.settlements.next();
      if (settlementResult.done === true) {
        break;
      }
      yield settlementResult.value;
    } finally {
      downstream.settlements.return();
    }
  }

  return {
    launches: createLaunches(),
    settlements: createSettlements(),
  };
}
```
