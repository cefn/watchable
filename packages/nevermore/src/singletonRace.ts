/* eslint-disable @typescript-eslint/promise-function-async */

/** Provides a formalism for 'switching' between winners of multiple races, but
 * guaranteeing to call `p.then()` at most twice for each promise even as part of
 * infinite loops.
 *
 * The approach ensures that a promise that's reused multiple times in races
 * (such as a promise of system shutdown or possibly-infinite stream completion)
 * doesn't become a source of memory leaks when every race creates additional
 * calls to `then()` which can't be undone.
 *
 * A common pattern in `@watchable` code before `singletonRace()` was something
 * like...
 *
 * ```ts
 * const winner = await Promise.race([
 *   sendPromise.then(() => "send"),
 *   shutdownPromise.then(() => "shutdown")
 * ]);
 * if(winner === "shutdown"){
 *   process.exit(0);
 * }
 * // handle send here
 * ```
 *
 * Unfortunately this creates two subscriptions to the long-lived
 * shutdownPromise via `.then()` on every race. One is explicit, to alias the
 * promise completion to a discriminating string the other is implicit
 * (Promise.race itself calls `.then()` on each promise passed to it).
 *
 * In this implementation, we eliminate the `.then()` call that created a
 * discriminating string promise, by instead using a cached singleton promise
 * (which already called `.then()` just once).
 *
 * We also use `race-as-promised` to eliminate the second `.then` call.
 */
import safeRace from "race-as-promised";

const singletons = new WeakMap<
  Promise<unknown>,
  Promise<readonly [Promise<unknown>]>
>();

function createSingleton<P extends Promise<unknown>>(promise: P) {
  const newSingleton = promise.then(() => [promise] as const);
  singletons.set(promise, newSingleton);
  return newSingleton;
}

function getSingleton<P extends Promise<unknown>>(promise: P) {
  return singletons.get(promise) as Promise<readonly [P]> | undefined;
}

function lazyCreateSingleton<P extends Promise<unknown>>(
  promise: P
): Promise<readonly [P]> {
  const cached = getSingleton(promise);
  return typeof cached !== "undefined" ? cached : createSingleton(promise);
}

export function singletonRace<
  const Promises extends ReadonlyArray<Promise<unknown>>
>(promises: Promises) {
  return safeRace(promises.map(lazyCreateSingleton)) as Promise<
    readonly [Promises[number]]
  >;
}

async function exampleRace(
  promiseA: Promise<string>,
  promiseB: Promise<number>
) {
  const [winner] = await singletonRace([promiseA, promiseB]);
  if (winner === promiseA) {
    return (await promiseA).includes("hello");
  }
  return (await promiseB).toFixed(2);
}
