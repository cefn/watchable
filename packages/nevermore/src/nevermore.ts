import type { Job } from "./types";
import { pull } from "./util";
import { createSourcePrimitive } from "./primitives/source";

/**
 * @param jobs An array, generator or other Iterable. Nevermore will pull jobs from it just-in-time.
 * @param cancelPromise If provided, Nevermore will cease launching jobs whenever this promise settles.
 * @returns
 */
export async function* nevermore<T, J extends Job<T>>(options: {
  jobs:
    | Iterable<J>
    | AsyncIterable<J>
    | (() => Generator<J>)
    | (() => AsyncGenerator<J>);
  cancelPromise?: Promise<unknown>;
}) {
  const sourcePrimitive = createSourcePrimitive(options);

  // Run background routine creating and launching jobs as fast as possible
  void pull(sourcePrimitive.launches, options.cancelPromise);

  yield* sourcePrimitive.settlements;
}
