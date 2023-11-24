/** The base strategy used to evaluate jobs and pass back their settlements after they have completed.
 * Typically this strategy exists at the end of a pipeline of other strategies which impose constraints
 * on the behaviour or flow of jobs.
 */

import { type MessageQueue, createQueue } from "@watchable/queue";
import type {
  Job,
  JobSettlement,
  LaunchesGenerator,
  SettlementsGenerator,
  Strategy,
} from "../types";

/** Creates a Promise<T> from every job passed to `launches.next(job)`. Tracks
 *  Promise resolution or rejection. Passes back JobSettlements via
 *  `settlements.next()`. */
export function createSettlerStrategy<J extends Job<unknown>>(
  cancelPromise: Promise<unknown> | null = null
): Strategy<J> {
  const queue: MessageQueue<JobSettlement<J>> = createQueue();

  async function triggerJob(job: J) {
    try {
      const value =
        (cancelPromise !== null ? await job({ cancelPromise }) : await job()) as Awaited<ReturnType<typeof job>>;
      queue.send({
        job,
        status: "fulfilled",
        value,
      });
    } catch (error) {
      queue.send({
        job,
        status: "rejected",
        reason: error,
      });
    }
  }

  async function* createLaunches(): LaunchesGenerator<J> {
    for (;;) {
      // yields immediately to accept a new job
      // spawns job in background without waiting
      // limits are expected 'upstream'
      void triggerJob(yield);
    }
  }

  async function* createSettlements(): SettlementsGenerator<J> {
    for (;;) {
      // immediately yield any job settlement
      yield await queue.receive();
    }
  }

  return {
    launches: createLaunches(),
    settlements: createSettlements(),
  };
}
