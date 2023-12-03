/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/promise-function-async */

export function namedRace<
  const NamedPromises extends Record<string, Promise<unknown>>
>(namedPromises: NamedPromises) {
  type Racer = Required<{
    [Name in keyof NamedPromises]: Promise<Name>;
  }>[keyof NamedPromises];

  const racers: Racer[] = Object.entries(namedPromises).map(([name, promise]) =>
    promise.then(() => name)
  );

  return Promise.race(racers);
}

export interface Biddable<Args extends unknown[]> {
  promise: Promise<Args>;
  fulfil: (...args: Args) => void;
  fail: (error: unknown) => void;
}

/** Reference implementation to give access to a Promise callback outside the
 * scope of a Promise constructor function. By default, FulfilmentArgs is a zero-length
 * array, meaning `callback` is `() => void` and `promise` is Promise<[]> - an
 * awaitable flag having no value.
 */
export function createBiddablePromise<Args extends unknown[] = []>() {
  // non-null required as per https://github.com/microsoft/TypeScript/issues/42910
  let fulfil!: (...args: Args) => void;
  let fail!: (reason?: unknown) => void;
  const promise = new Promise<Args>((resolve, reject) => {
    fulfil = (...args) => {
      resolve(args);
    };
    fail = reject;
  });
  return {
    promise,
    fulfil,
    fail,
  } satisfies Biddable<Args>;
}

/** Construct for an awaitable `notify()` callback, with `notified` indicating whether it has been called. */
export function createFlag() {
  const { promise, fulfil } = createBiddablePromise();
  const notifiableFlag = {
    promise,
    flagged: false,
    flag: () => {
      notifiableFlag.flagged = true;
      fulfil();
    },
  };
  return notifiableFlag;
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
      iteratorResult = await Promise.race([
        iteratorPromise,
        cancelRacer,
      ] as const);
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

export function asyncIterable<T>(iterator: AsyncIterator<T>): AsyncIterable<T> {
  return { [Symbol.asyncIterator]: () => iterator };
}

export function promiseMessage<Message extends string>(
  promise: Promise<unknown>,
  message: Message
): Promise<Message> {
  return promise.then(() => message);
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

// eslint-disable-next-line @typescript-eslint/promise-function-async
export function sleep(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
