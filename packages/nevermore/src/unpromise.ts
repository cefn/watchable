/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable @typescript-eslint/promise-function-async */

/** A promise that exploits a single, memory-safe upstream subscription
 * to a single re-used Unpromise that persists for the VM lifetime of a
 * Promise.
 *
 * Calling unsubscribe() removes the subscription, eliminating
 * all references to the SubscribedPromise. */
export type SubscribedPromise<T> = Promise<T> & { unsubscribe: () => void };

/** A standard pattern for a resolvable, rejectable Promise, based
 * on the emerging ES2023 standard. Type ported from
 * https://github.com/microsoft/TypeScript/pull/56593 */
export interface PromiseWithResolvers<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

/** Given an array, this is the union of its members' types. */
export type MemberOf<Arr extends readonly unknown[]> = Arr[number];

/** Memory safe (weakmapped) records of each Promise's Unpromise which
 * will only last for the lifetime of the Promise themselves.
 */
const unpromiseCache = new WeakMap<Promise<unknown>, Unpromise<unknown>>();

/** A NOOP function allowing a consistent interface for settled
 * SubscribedPromises (settled promises are not subscribed - they resolve immediately). */
const NOOP = () => {};

/** Reference implementation of https://github.com/tc39/proposal-promise-with-resolvers */
function withResolvers<T>(): PromiseWithResolvers<T> {
  let resolve!: PromiseWithResolvers<T>["resolve"];
  let reject!: PromiseWithResolvers<T>["reject"];
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = (value) => {
      _resolve(value);
    };
    reject = (error) => {
      _reject(error);
    };
  });
  return {
    promise,
    resolve,
    reject,
  };
}

/**
 * Every `Promise<T>` has a single `Unpromise<T>` that is created once, then
 * cached and reused throughout the lifetime of the Promise. Get a Promise's
 * Unpromise using `Unpromise.get(promise)`.
 *
 * The `Unpromise<T>` looks after attaching to the original `Promise<T>`
 * `.then()` and `.catch()` just once. It then implements the normal
 * `Promise<T>` interface via a subscription- (and unsubscription-) based
 * mechanism
 *
 * Every time you call `.subscribe()`, `.then()` `.catch()` or `.finally()` the
 * returned Promise has an additional `unsubscribe()` method allowing it to be
 * cleanly detached from the upstream Promise.
 *
 * Calls to `Promise.race(subscribedPromises)` and
 * `Promise.any(subscribedPromises)` involving long-lived promises can be
 * followed up by calling `subscribedPromise.unsubscribe()` to detach each
 * Promise.
 *
 * This approach can eliminate the memory leaks that otherwise come about from
 * repeated `race()` or `any()` calls invoking `.then()` and `.catch()` multiple
 * times on the same long-lived native Promise (subscriptions which can never be
 * cleaned up).
 *
 * `Unpromise.resolve(promise)` returns a `SubscribedPromise<T>` equivalent to
 * any given `Promise<T>`, (this is implemented simply as
 * `Unpromise.get(promise).subscribe()`).
 *
 * `Unpromise.race(promises)` provides a reference implementation of
 * `Promise.race` which avoids memory leaks when using long-lived unsettled
 * Promises.
 *
 * `Unpromise.any(promises)` provides a reference implementation of
 * `Promise.any` which avoids memory leaks when using long-lived unsettled
 * Promises.
 */
export class Unpromise<T> implements Promise<T> {
  /** Promises expecting eventual settlement (unless unsubscribed first). This list is deleted
   * after the original promise settles - no more notifications will ever be issued. */
  protected subscribers: ReadonlyArray<PromiseWithResolvers<T>> | null = [];

  /** The Promise's settlement (recorded when it fulfils or rejects). This is consulted when
   * calling .subscribe() .then() .catch() .finally() to see if an immediately-resolving Promise
   * can be returned, and therefore subscription can be bypassed. */
  protected settlement: PromiseSettledResult<T> | null = null;

  /** Initialises an Unpromise. Adds `.then()` and `.catch()` handlers to the
   * original Promise. These handlers pass fulfilment and rejection
   * notifications on to downstream subscribers and control the settlement
   * record for this Unpromise. */
  protected constructor(readonly promise: Promise<T>) {
    // subscribe for eventual fulfilment and rejection
    void promise
      .then((value) => {
        // atomically record fulfilment and detach subscriber list
        const { subscribers } = this;
        this.subscribers = null;
        this.settlement = {
          status: "fulfilled",
          value,
        };
        // notify fulfilment to subscriber list
        subscribers?.forEach(({ resolve }) => {
          resolve(value);
        });
      })
      .catch((reason) => {
        // atomically record rejection and detach subscriber list
        const { subscribers } = this;
        this.subscribers = null;
        this.settlement = {
          status: "rejected",
          reason,
        };
        // notify rejection to subscriber list
        subscribers?.forEach(({ reject }) => {
          reject(reason);
        });
      });
  }

  /** Create a promise that mitigates uncontrolled subscription to a long-lived
   * Promise via .then() and .catch() - otherwise a source of memory leaks.
   *
   * The returned promise has an `unsubscribe()` method which can be called when
   * the Promise is no longer being tracked by application logic, and which
   * ensures that there is no reference chain from the original promise to the
   * new one, and therefore no memory leak.
   *
   * If original promise has not yet settled, this adds a new unique promise
   * that listens to then/catch events, along with an `unsubscribe()` method to
   * detach it.
   *
   * If original promise has settled, then creates a new Promise.resolve() or
   * Promise.reject() and provided unsubscribe is a noop.
   *
   * If you call `unsubscribe()` before the returned Promise has settled, it
   * will never settle.
   */
  subscribe(): SubscribedPromise<T> {
    // in all cases we will combine some promise with its unsubscribe function
    let promise: Promise<T>;
    let unsubscribe: () => void;

    const { settlement } = this;
    if (settlement === null) {
      // not yet settled - subscribe new promise. Expect eventual settlement
      if (this.subscribers === null) {
        // invariant - not settled, must have subscribers
        throw new Error("Unpromise settled but still has subscribers");
      }
      const subscriber = withResolvers<T>();
      this.subscribers = listWithMember(this.subscribers, subscriber);
      promise = subscriber.promise;
      unsubscribe = () => {
        if (this.subscribers !== null) {
          this.subscribers = listWithoutMember(this.subscribers, subscriber);
        }
      };
    } else {
      // settled - don't create subscribed promise. Just resolve or reject
      const { status } = settlement;
      if (status === "fulfilled") {
        promise = Promise.resolve(settlement.value);
      } else {
        promise = Promise.reject(settlement.reason);
      }
      unsubscribe = NOOP;
    }

    // extend promise signature with the extra method
    return Object.assign(promise, { unsubscribe });
  }

  /** STANDARD PROMISE METHODS (but returning a SubscribedPromise) */

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined
  ): SubscribedPromise<TResult1 | TResult2> {
    const subscribed = this.subscribe();
    const { unsubscribe } = subscribed;
    return Object.assign(subscribed.then(onfulfilled, onrejected), {
      unsubscribe,
    });
  }

  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | null
      | undefined
  ): SubscribedPromise<T | TResult> {
    const subscribed = this.subscribe();
    const { unsubscribe } = subscribed;
    return Object.assign(subscribed.catch(onrejected), {
      unsubscribe,
    });
  }

  finally(onfinally?: (() => void) | null | undefined): SubscribedPromise<T> {
    const subscribed = this.subscribe();
    const { unsubscribe } = subscribed;
    return Object.assign(subscribed.finally(onfinally), {
      unsubscribe,
    });
  }

  /** TOSTRING SUPPORT */

  readonly [Symbol.toStringTag] = "Unpromise";

  /** Unpromise STATIC METHODS */

  /** Create and store an Unpromise keyed by an original Promise. */
  protected static createCachedUnpromise<T>(promise: Promise<T>) {
    const created = new Unpromise<T>(promise);
    unpromiseCache.set(promise, created as Unpromise<unknown>); // resolve promise to unpromise
    unpromiseCache.set(created, created as Unpromise<unknown>); // resolve the unpromise to itself
    return created;
  }

  /** Retrieve a previously-created Unpromise keyed by an original Promise. */
  protected static getCachedUnpromise<T>(promise: Promise<T>) {
    return unpromiseCache.get(promise) as Unpromise<T> | undefined;
  }

  /** Create or Retrieve the Unpromise (a re-used Unpromise for the VM lifetime
   * of the provided Promise reference) */
  static get<T>(promise: Promise<T>): Unpromise<T> {
    const cached = Unpromise.getCachedUnpromise(promise);
    return typeof cached !== "undefined"
      ? cached
      : Unpromise.createCachedUnpromise(promise);
  }

  /** Promise STATIC METHODS */

  /** Lookup the Unpromise for this promise, and derive a SubscribedPromise from
   * it (that can be later unsubscribed to eliminate Memory leaks) */
  static resolve<T>(promise: Promise<T>): SubscribedPromise<T> {
    return Unpromise.get(promise).subscribe();
  }

  /** Perform Promise.any() via SubscribedPromises, then unsubscribe them.
   * Equivalent to Promise.any but eliminates memory leaks from long-lived
   * promises accumulating .then() and .catch() subscribers. */
  static async any<const Promises extends ReadonlyArray<Promise<unknown>>>(
    promises: Promises
  ) {
    const subscribedPromises = promises.map(Unpromise.resolve);
    try {
      return await Promise.any(subscribedPromises);
    } finally {
      subscribedPromises.forEach(({ unsubscribe }) => {
        unsubscribe();
      });
    }
  }

  /** Perform Promise.race via SubscribedPromises, then unsubscribe them.
   * Equivalent to Promise.race but eliminates memory leaks from long-lived
   * promises accumulating .then() and .catch() subscribers. */
  static async race<const Promises extends ReadonlyArray<Promise<unknown>>>(
    promises: Promises
  ) {
    const subscribedPromises = promises.map(Unpromise.resolve);
    try {
      return await Promise.race(subscribedPromises);
    } finally {
      subscribedPromises.forEach(({ unsubscribe }) => {
        unsubscribe();
      });
    }
  }

  /** Race promises as SubscribedPromises that fulfil to 1-tuples referencing the promise
   * Unsubscribe temporary promises to eliminate memory leaks. */
  static async raceSingletons<
    const Promises extends ReadonlyArray<Promise<unknown>>
  >(promises: Promises) {
    // a Singleton is a 1-Tuple containing just one of the Promises
    type Singleton = readonly [MemberOf<Promises>];

    // for each promise, create a SubscribedPromise for the 1-tuple of that
    // promise. The SubscribedPromise resolves when the promise resolves, and
    // can be unsubscribed after the race
    const singletons: Array<SubscribedPromise<Singleton>> = promises.map(
      (promise) => Unpromise.get(promise).then(() => [promise] as const)
    );

    // now race the resulting promises, (will fulfil to some Singleton or reject)
    // and unsubscribe them when the race is over, to mitigate memory leaks
    try {
      return await Promise.race(singletons);
    } finally {
      for (const singleton of singletons) {
        singleton.unsubscribe();
      }
    }
  }
}

/** IMMUTABLE LIST OPERATIONS */

function listWithMember<T>(arr: readonly T[], member: T): readonly T[] {
  return [...arr, member];
}

function listWithoutIndex<T>(arr: readonly T[], index: number) {
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

function listWithoutMember<T>(arr: readonly T[], member: unknown) {
  const index = arr.indexOf(member as T);
  if (index !== -1) {
    return listWithoutIndex(arr, index);
  }
  return arr;
}
