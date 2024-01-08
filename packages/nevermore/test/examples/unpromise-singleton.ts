/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable @typescript-eslint/promise-function-async */
import { getUnpromise } from "../../src/unpromise";

// also problem for promise.any

export async function singletonRace<
  const Promises extends ReadonlyArray<Promise<unknown>>
>(promises: Promises) {
  const mappedPromises = promises.map((promise) => {
    const unpromise = getUnpromise(promise);
    return unpromise.then(() => [promise] as const);
  });
  try {
    return Promise.race(mappedPromises) as Promise<readonly [Promises[number]]>;
  } finally {
    mappedPromises.forEach(({ unsubscribe }) => {
      unsubscribe();
    });
  }
}

export async function exampleRace(
  promiseA: Promise<string>,
  promiseB: Promise<number>
) {
  const [winner] = await singletonRace([promiseA, promiseB]);
  if (winner === promiseA) {
    return (await promiseA).includes("foo");
  }
  return (await promiseB).toFixed(2);
}
