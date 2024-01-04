/* eslint-disable @typescript-eslint/promise-function-async */

/** The base strategy used to evaluate jobs and pass back their settlements after they have completed.
 * Typically this strategy exists at the end of a pipeline of other strategies which impose constraints
 * on the behaviour or flow of jobs.
 *
 * The strategy accepts jobs through launchJob(), and a notification that no more jobs will be launched
 * with launchesDone(). The next() call yields settlements of jobs until it is established that
 * no more launches will take place, and all launched jobs are settled.
 */
import safeRace from "race-as-promised";
import { type MessageQueue, createQueue } from "@watchable/queue";
import type { Job, JobSettlement, Strategy } from "../types";
import { createFlag } from "../util";

/** Creates a Promise<T> from every job passed to `launches.next(job)`. Tracks
 *  Promise resolution or rejection. Doesn't await completion of job.  Wires
 *  JobSettlements to `settlements.next()`. */
export function createLauncherStrategy<J extends Job<unknown>>(
  cancelPromise: Promise<unknown> | null = null
): Strategy<J> {
  const throwOnCancel: Promise<never> | null =
    cancelPromise !== null
      ? cancelPromise.then(() => {
          throw new Error(
            "No further nevermore settlements: cancelPromise is fulfilled. "
          );
        })
      : null;

  let unsettledJobs = 0;
  const launchesFinalized = createFlag();
  const queue: MessageQueue<JobSettlement<J>> = createQueue();

  // optimisation: fulfil Promise<void> signature of
  // launchJob without overhead of async function
  const voidPromise = Promise.resolve();

  return {
    launchJob(job: J) {
      // record that job is launched
      unsettledJobs++;

      // create promise of job completion
      const valuePromise = (
        cancelPromise !== null ? job({ cancelPromise }) : job()
      ) as Promise<Awaited<ReturnType<typeof job>>>;

      // launcher deliberately doesn't await completion of the job
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

      // fulfil immediately
      return voidPromise;
    },
    launchesDone() {
      launchesFinalized.flag();
    },
    async next() {
      // one-off queue read : precious + must be awaited (unless whole strategy cancelled)
      const queuePromise = queue.receive();

      // handle settlement (and optionally also cancellation)
      const settlementPromise =
        throwOnCancel !== null
          ? safeRace([throwOnCancel, queuePromise])
          : queuePromise;

      if (unsettledJobs === 0 && !launchesFinalized.flagged) {
        // unsure if there will be future settlements
        // wait on both launchesDone AND settlement
        await safeRace([launchesFinalized.promise, settlementPromise]);
      }

      // check if finished
      if (unsettledJobs === 0 && launchesFinalized.flagged) {
        // settlements finalized (no more launches or settlements expected)
        return {
          done: true,
          value: undefined,
        } satisfies IteratorResult<JobSettlement<J>>;
      }

      // at least one unfinalised settlement still to wait for
      const settlement = await settlementPromise;

      // record that job is settled
      unsettledJobs--;
      return {
        done: false,
        value: settlement,
      };
    },
  } satisfies Strategy<J>;
}
