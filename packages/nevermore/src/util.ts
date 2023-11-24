/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/promise-function-async */

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
export function promiseWithFulfil<Args extends unknown[] = []>() {
  // non-null required as per https://github.com/microsoft/TypeScript/issues/42910
  let fulfil!: (...args: Args) => void;
  const promise = new Promise<Args>((resolve) => {
    fulfil = (...args) => {
      resolve(args);
    };
  });
  return {
    promise,
    fulfil,
  };
}

/** Construct for an awaitable `notify()` callback, with `notified` indicating whether it has been called. */
export function createNotifiable<Args extends unknown[] = []>() {
  const { promise, fulfil } = promiseWithFulfil<Args>();
  const notifiable = {
    promise,
    notified: false,
    notify: (...args: Args) => {
      notifiable.notified = true;
      fulfil(...args);
    },
  };
  return notifiable;
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
    if (iteratorResult.done === true) {
      // done
      return;
    }
  }
}

/** Begin iteration, (agnostic to Async or Sync iterators). */
export function iterator<T>(
  sequence: Iterable<T> | AsyncIterable<T>
): Iterator<T> | AsyncIterator<T> {
  if (Symbol.asyncIterator in sequence) {
    return sequence[Symbol.asyncIterator]();
  }
  return sequence[Symbol.iterator]();
}

export function asyncIterable<T>(iterator: AsyncIterator<T>): AsyncIterable<T> {
  return { [Symbol.asyncIterator]: () => iterator };
}

export async function promiseMessage<Message extends string>(
  promise: Promise<unknown>,
  message: Message
): Promise<Message> {
  return await promise.then(() => message);
}

export function serializeError(err: unknown) {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err?.toString === "function") {
    const stringValue = err.toString();
    if (stringValue !== "" && stringValue !== "[object Object]") {
      return stringValue;
    }
  }
  return JSON.stringify(err);
}
