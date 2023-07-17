import type { GNexted, GReturned } from "./types";

/** Launches a background loop to consume and ignore
 * an iterator's values as fast as they are yielded,
 * If a provided cancelPromise is resolved, this
 * will cancel the loop.
 */
export function pull<T>(
  iterator: AsyncIterator<T>,
  cancelPromise?: Promise<unknown>
) {
  const cancelRacer =
    cancelPromise !== undefined ? cancelPromise.then(() => "cancel") : null;

  // loop awaits every iteration until cancelled or done
  const loop = async () => {
    for (;;) {
      const iteratorPromise = iterator.next();
      if (cancelRacer === null) {
        await iteratorPromise;
      } else if (
        (await Promise.race([iteratorPromise, cancelRacer])) === "cancel"
      ) {
        // cancelled, end the loop
        return;
      }
    }
  };

  // launch loop in background
  void loop();
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

/** Creates a callback having specified Args and a Promise that resolves when it is called.
 * The callback has an `invocation` member that is initially null, and stores the callback's args
 * when it is first invoked. Invoking the callback twice is an error. Args are empty by default,
 * creating an eventually notified 'flag' you can wait on. */
export function createAwaitable<Args extends unknown[] = []>() {
  // reference that can be assigned in Promise scope, then returned
  let callback!: ((...args: Args) => void) & { invocation: null | Args };

  // promise of eventual callback invocation
  const callbackPromise = new Promise<Args>((resolve) => {
    // assign callback in promise ascope
    callback = Object.assign(
      // first call stores args and resolves promise
      // second call is an error
      (...args: Args) => {
        if (callback.invocation === null) {
          callback.invocation = args;
          resolve(args);
        }
        throw new Error(
          `Callback already called once with ${callback.invocation.toString()}`
        );
      },
      // member variable for storing args
      { invocation: null }
    );
  });

  // Compound return
  return {
    callback,
    callbackPromise,
  };
}

export async function promiseMessage<Message extends string>(
  promise: Promise<unknown>,
  message: Message
): Promise<Message> {
  return await promise.then(() => message);
}
