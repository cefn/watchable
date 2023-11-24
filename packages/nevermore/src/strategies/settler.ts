/** The base strategy used to evaluate jobs and pass back their settlements after they have completed.
 * Typically this strategy exists at the end of a pipeline of other strategies which impose constraints
 * on the behaviour or flow of jobs.
 */

import { type MessageQueue, createQueue } from "@watchable/queue";
import type { Job, JobSettlement, Strategy } from "../types";

/** Creates a Promise<T> from every job passed to `launches.next(job)`. Tracks
 *  Promise resolution or rejection. Passes back JobSettlements via
 *  `settlements.next()`. */
export function createSettlerStrategy<T, J extends Job<T>>(
  cancelPromise: Promise<unknown> | null = null
): Strategy<T, J> {
  const queue: MessageQueue<JobSettlement<T, J>> = createQueue();

  async function triggerJob(job: J) {
    try {
      const value =
        cancelPromise !== null ? await job({ cancelPromise }) : await job();
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

  async function* createLaunches(): AsyncGenerator<void, void, J> {
    for (;;) {
      // yields immediately to accept a new job
      // spawns job in background without waiting
      // limits are expected 'upstream'
      void triggerJob(yield);
    }
  }

  async function* createSettlements(): AsyncGenerator<
    JobSettlement<T, J>,
    void,
    void
  > {
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
