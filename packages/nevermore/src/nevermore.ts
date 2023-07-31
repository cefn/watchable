import type { Job, NevermoreOptions } from "./types";
import { pull } from "./util";
import { sourceFeed } from "./primitives/source";
import { createConcurrencyFeed } from "./primitives/concurrency";

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

  let feed = sourceFeed({ cancelPromise }, jobs);

  if (typeof concurrency === "number") {
    feed = createConcurrencyFeed({ concurrency }, feed);
  }

  // Run background routine creating and launching jobs as fast as possible
  void pull(feed.launches, options.cancelPromise);

  yield* feed.settlements;
}
