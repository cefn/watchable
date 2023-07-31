import type { ConcurrencyOptions, Job, Primitive } from "../types";
import { createAwaitableFlag } from "../util";

export function createConcurrencyPrimitive<T, J extends Job<T>>(
  source: Primitive<T, J>,
  options: ConcurrencyOptions
) {
  const { concurrency } = options;
  if (concurrency < 1) {
    throw new Error(
      `Concurrency cannot be less than 1 : ${JSON.stringify({ concurrency })}`
    );
  }

  let concurrentJobs = 0;
  let notifier: ReturnType<typeof createAwaitableFlag> | null = null;

  async function* createLaunches() {
    for await (const job of source.launches) {
      concurrentJobs++;
      yield job;
      if (concurrentJobs >= concurrency) {
        notifier = createAwaitableFlag();
        await notifier.promise;
      }
    }
  }

  async function* createSettlements() {
    for await (const settlement of source.settlements) {
      concurrentJobs--;
      if (notifier !== null) {
        notifier.flag();
        notifier = null;
      }
      yield settlement;
    }
  }

  const concurrencyPrimitive = {
    launches: createLaunches(),
    settlements: createSettlements(),
  };

  return concurrencyPrimitive;
}
