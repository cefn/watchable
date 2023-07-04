/** The base strategy used to evaluate jobs and pass back their settlements after they have completed.
 * Typically this strategy exists at the end of a pipeline of other strategies which impose constraints
 * on the behaviour or flow of jobs.
 */

import { type MessageQueue, createQueue } from "@watchable/queue";
import type { Job, JobSettlement, Strategy } from "../types";
import { createNotifiable } from "..";

/** Creates a Promise<T> from every job passed to `launches.next(job)`. Tracks
 *  Promise resolution or rejection. Passes back JobSettlements via
 *  `settlements.next()`. */
export function createSettlerStrategy<J extends Job<unknown>>(
  cancelPromise: Promise<unknown> | null = null
): Strategy<J> {
  let activeJobs = 0;
  const launchesFinalized = createNotifiable();
  const queue: MessageQueue<JobSettlement<J>> = createQueue();

  return {
    async launchJob(job: J) {
      activeJobs++;
      const valuePromise = (
        cancelPromise !== null ? job({ cancelPromise }) : job()
      ) as Promise<Awaited<ReturnType<typeof job>>>;
      valuePromise
        .then((value) =>
          queue.send({
            job,
            status: "fulfilled",
            value,
          })
        )
        .catch((reason) =>
          queue.send({
            job,
            status: "rejected",
            reason,
          })
        );
    },
    launchesDone() {
      launchesFinalized.notify();
    },
    async next() {
      const settlementPromise = queue.receive();
      if (!launchesFinalized.notified) {
        // unblock when either launches finalize or queue event arrives
        // (checks for active Jobs before blocking on future settlement)
        await Promise.race([launchesFinalized.promise, settlementPromise]);
      }
      if (launchesFinalized.notified && activeJobs === 0) {
        // settlements finalized (no more launches or settlements expected)
        return {
          done: true,
          value: undefined,
        } satisfies IteratorResult<JobSettlement<J>>;
      }
      // at least one unfinalised settlement still to wait for
      const settlement = await settlementPromise;
      activeJobs--;
      return {
        done: false,
        value: settlement,
      };
    },
  } satisfies Strategy<J>;
}
