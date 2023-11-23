import { type MessageQueue, createQueue } from "@watchable/queue";
import type { Job, JobSettlement, Strategy } from "../types";

/** Creates a Promise<T> from every job passed to `launches.next(job)`. Tracks
 *  Promise resolution or rejection. Passes back JobSettlements via
 *  `settlements.next()`. */
export function createSettlerStrategy<T, J extends Job<T>>(
  cancelPromise: Promise<unknown> | null = null
) {
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

  const settlerStrategy: Strategy<T, J> = {
    launches: {
      async next(job: J) {
        // spawns job in background without waiting
        void triggerJob(job);
        // yields immediately to accept a new job
        // limits are expected to be 'upstream'
        return {
          value: undefined,
          done: false,
        } satisfies IteratorResult<void>;
      },
    },
    settlements: {
      async next() {
        // awaits job settlement
        const value = await queue.receive();
        // yields immediately
        return {
          value,
          done: false,
        } satisfies IteratorResult<JobSettlement<T, J>>;
      },
    },
  };

  return settlerStrategy;
}
