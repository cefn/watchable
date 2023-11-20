import type { Job, NevermoreOptions } from "./types";
import { namedRace } from "./util";
import { createSourceFeed } from "./primitives/source";
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

  let feed = createSourceFeed({ cancelPromise });

  if (typeof concurrency === "number") {
    feed = createConcurrencyFeed({ concurrency }, feed);
  }

  // zero-arg (async?) generator functions should be called to create an iterable
  const jobIterable =
    Symbol.iterator in jobs || Symbol.asyncIterator in jobs ? jobs : jobs();

  // Feeds jobs one by one, awaits launch resolution before feeding the next
  async function triggerLaunches() {
    for await (const job of jobIterable) {
      const launchPromise = feed.launches.next(job);
      if (cancelPromise !== undefined) {
        const result = await namedRace({
          launchPromise,
          cancelPromise,
        });
        if (result === "cancelPromise") {
          throw new Error(`Cancelled`);
        }
      } else {
        await launchPromise;
      }
    }
    void feed.launches.return(); // completion of feed launches generator
  }

  void triggerLaunches();

  yield* feed.settlements;
}
