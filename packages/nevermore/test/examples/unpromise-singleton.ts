/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable @typescript-eslint/promise-function-async */
import { Unpromise } from "../../src/unpromise";

// also problem for promise.any

export async function raceStringAndNumber(
  promiseA: Promise<string>,
  promiseB: Promise<number>
) {
  const [winner] = await Unpromise.raceSingletons([promiseA, promiseB]);
  if (winner === promiseA) {
    return (await promiseA).includes("foo");
  }
  return (await promiseB).toFixed(2);
}
