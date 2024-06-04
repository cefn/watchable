/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/promise-function-async */

import { Unpromise } from "@watchable/unpromise";

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
  cancelPromise: Promise<unknown> | null = null
) {
  // loop awaits every iteration until cancelled or done
  for (;;) {
    const iteratorPromise = iterator.next();

    if (cancelPromise !== null) {
      // watch both next value AND cancelPromise
      const [winner] = await Unpromise.raceReferences([
        iteratorPromise,
        cancelPromise,
      ]);
      if (winner === cancelPromise) {
        // pull loop is cancelled
        return;
      }
    }

    // resolve next value
    const iteratorResult = await iteratorPromise;
    if (iteratorResult.done === true) {
      // done
      return;
    }
  }
}

export function asyncIterable<T>(iterator: AsyncIterator<T>): AsyncIterable<T> {
  return { [Symbol.asyncIterator]: () => iterator };
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
