import type { GNexted, GReturned } from "./types";

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

/** Creates a callback having specified Args referenced from a Promise that resolves when it is called.
 * The callback has an `invocation` member that is initially null, and stores the callback's args
 * when it is first invoked. Invoking the callback twice is an error. Args are empty by default,
 * creating an eventually notified 'flag' you can wait on. */
// eslint-disable-next-line @typescript-eslint/promise-function-async
export function createCallable<Args extends unknown[] = []>() {
  // reference that can be assigned in Promise scope, then returned
  let callback!: (...args: Args) => void;

  // promise of eventual callback invocation
  const awaitable: Promise<Args> & {
    invocation: null | Args;
    callback: typeof callback;
    wasCalled: () => boolean;
  } = Object.assign(
    new Promise<Args>((resolve) => {
      // assign callback in promise ascope
      // first call stores args and resolves promise
      // second call is an error
      callback = (...args: Args) => {
        if (awaitable.invocation === null) {
          awaitable.invocation = args;
          resolve(args);
        }
        throw new Error(
          `Callback already called once with ${awaitable.invocation.toString()}`
        );
      };
    }),
    {
      /** Member variable for storing args */
      invocation: null,
      /** Callback to resolve promise */
      callback,
      /** Convenience method to check if it was invoked */
      wasCalled() {
        return awaitable.invocation !== null;
      },
    }
  );

  // Compound return
  return awaitable;
}

export async function promiseMessage<Message extends string>(
  promise: Promise<unknown>,
  message: Message
): Promise<Message> {
  return await promise.then(() => message);
}
