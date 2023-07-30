/* eslint-disable @typescript-eslint/promise-function-async */
import type { GNexted, GReturned } from "./types";

export function namedRace<
  const NamedPromises extends Record<
    string,
    NonNullable<unknown> | Promise<unknown>
  >
>(namedPromises: NamedPromises) {
  type Racer = Required<{
    [Name in keyof NamedPromises]: Name | Promise<Name>;
  }>[keyof NamedPromises];

  const racers: Racer[] = Object.entries(namedPromises).map(
    ([name, promise]) => {
      if ("then" in promise) {
        return promiseMessage(promise, name);
      }
      return name;
    }
  );

  return Promise.race(racers);
}

/** Reference implementation to give access to a Promise callback outside the
 * scope of a Promise constructor function. By default, Args is a zero-length
 * array, meaning `callback` is `() => void` and `promise` is Promise<[]> - an
 * awaitable flag having no value.
 */
export function promiseWithCallback<Args extends unknown[] = []>() {
  let callback!: (...args: Args) => void; // non-null required as per https://github.com/microsoft/TypeScript/issues/42910
  const promise = new Promise<Args>((resolve) => {
    callback = (...args) => {
      resolve(args);
    };
  });
  return {
    promise,
    callback,
  };
}

/** Construct for an awaitable `flag()` callback, with `flagged` indicating whether it has been called. */
export function createAwaitableFlag() {
  const { promise, callback } = promiseWithCallback();
  const awaitableFlag = {
    promise,
    flagged: false,
    flag: () => {
      awaitableFlag.flagged = true;
      callback();
    },
  };
  return awaitableFlag;
}

/** A loop that consumes an async iterator's values strictly in
 * sequence as fast as they can be yielded and resolved. Resolved values are ignored.
 * Rejected values will cause `pull` to throw the error. If a provided cancelPromise
 * is resolved, this will cancel the loop.
 */
export async function pull<T>(
  iterator: AsyncIterator<T>,
  cancelPromise?: Promise<unknown>
) {
  const cancelRacer =
    cancelPromise !== undefined
      ? promiseMessage(cancelPromise, "cancel")
      : null;

  // loop awaits every iteration until cancelled or done
  for (;;) {
    const iteratorPromise = iterator.next();
    let iteratorResult: IteratorResult<T> | "cancel";
    if (cancelRacer === null) {
      iteratorResult = await iteratorPromise;
    } else {
      iteratorResult = await Promise.race([iteratorPromise, cancelRacer]);
      if (iteratorResult === "cancel") {
        // cancelled
        return;
      }
    }
    if (iteratorResult.done ?? false) {
      // done
      return;
    }
  }
}

export function decorateSequence<
  G extends Generator<Yielded>,
  Yielded,
  Decorated
>(
  generator: G,
  decorate: (yielded: Yielded) => Decorated
): Generator<Decorated, GReturned<G>, GNexted<G>> {
  function mapResult(
    result: IteratorResult<Yielded, GReturned<G>>
  ): IteratorResult<Decorated, GReturned<G>> {
    const decoratedResult: IteratorResult<
      Decorated,
      GReturned<G>
    > = result.done === true
      ? result
      : {
          done: result.done,
          value: decorate(result.value),
        };
    return decoratedResult;
  }

  return {
    [Symbol.iterator]() {
      return this;
    },
    next(...args) {
      return mapResult(generator.next(...args));
    },
    return(value) {
      return mapResult(generator.return(value));
    },
    throw(e) {
      return mapResult(generator.throw(e));
    },
  };
}

/** Begin iteration, (agnostic to Async or Sync iterators). */
export function iterableToIterator<T>(
  sequence: Iterable<T> | AsyncIterable<T>
): Iterator<T> | AsyncIterator<T> {
  if (Symbol.asyncIterator in sequence) {
    return sequence[Symbol.asyncIterator]();
  }
  return sequence[Symbol.iterator]();
}

export async function promiseMessage<Message extends string>(
  promise: Promise<unknown>,
  message: Message
): Promise<Message> {
  return await promise.then(() => message);
}
