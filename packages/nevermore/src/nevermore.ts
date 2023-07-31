import type { Job, NevermoreOptions } from "./types";
import { pull } from "./util";
import { createSourcePrimitive } from "./primitives/source";
import { createConcurrencyPrimitive } from "./primitives/concurrency";

/**
 * @param jobs An array, generator or other Iterable. Nevermore will pull jobs from it just-in-time.
 * @param cancelPromise If provided, Nevermore will cease launching jobs whenever this promise settles.
 * @returns
 */
export async function* nevermore<T, J extends Job<T>>(
  options: NevermoreOptions,
  jobs:
    | Iterable<J>
    | AsyncIterable<J>
    | (() => Generator<J>)
    | (() => AsyncGenerator<J>)
) {
  const { concurrency, cancelPromise } = options;

  let primitive = createSourcePrimitive({ cancelPromise }, jobs);

  if (typeof concurrency === "number") {
    primitive = createConcurrencyPrimitive(primitive, { concurrency });
  }

  // Run background routine creating and launching jobs as fast as possible
  void pull(primitive.launches, options.cancelPromise);

  yield* primitive.settlements;
}
