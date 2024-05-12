/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable @typescript-eslint/promise-function-async */

/** The base strategy used to evaluate jobs and pass back their settlements after they have completed.
 * Typically this strategy exists at the end of a pipeline of other strategies which impose constraints
 * on the behaviour or flow of jobs.
 *
 * The strategy accepts jobs through launchJob(), and a notification that no more jobs will be launched
 * with launchesDone(). The next() call yields settlements of jobs until it is established that
 * no more launches will take place, and all launched jobs are settled. It accepts a constructor argument
 * passing a cancelPromise which will be monitored to shut down the strategy (notifying all jobs, throwing
 * an error for consumers of settlements)
 */
import { createQueue } from "@watchable/queue";
import type { Job, JobSettlement, NothingFrom, Strategy } from "../types";
import { createFlag } from "../util";
import { type SubscribedPromise, Unpromise } from "@watchable/unpromise";

interface JobCancelOptions {
  jobCancelPromise: SubscribedPromise<unknown>;
}

type JobSettlementWithCancel<J extends Job<unknown>> = JobSettlement<J> &
  (JobCancelOptions | NothingFrom<JobCancelOptions>);

/** Creates a Promise<T> from every job passed to `launches.next(job)`. Tracks
 *  Promise resolution or rejection. Doesn't await completion of job.  Wires
 *  JobSettlements to `settlements.next()`. */
export function createLauncherStrategy<J extends Job<unknown>>(
  cancelPromise: Promise<unknown> | null = null
): Strategy<J> {
  let unsettledJobs = 0;
  const launchesFinalized = createFlag();
  // optimization, use Unpromise references up front rather than
  // having a WeakMap lookup for the Unpromise on every race
  const finalizeUnpromise = Unpromise.resolve(launchesFinalized.promise);
  const cancelUnpromise =
    cancelPromise !== null ? Unpromise.resolve(cancelPromise) : null;
  const queue = createQueue<JobSettlementWithCancel<J>>();

  // optimisation: fulfil Promise<void> signature of
  // launchJob without overhead of async function
  const voidPromise = Promise.resolve();

  /** Monitors relevant events, eventually composing next settlement
   * IteratorResult. Returns either a further settlement or the end of all settlements.
   */
  async function promiseSettlementResult(
    queuePromise: ReturnType<(typeof queue)["receive"]>
  ) {
    // await only if more settlements may come
    if (unsettledJobs > 0 || !launchesFinalized.flagged) {
      // potentially block also on cancel or launchesFinalized
      const [unblocker] =
        cancelPromise === null && launchesFinalized.flagged
          ? [queuePromise]
          : await Unpromise.raceReferences([
              // unblocker when job settles
              queuePromise,
              // unblocker when launches are finalized
              ...(!launchesFinalized.flagged ? [finalizeUnpromise] : []),
              // unblocker when launcher is cancelled
              ...(cancelUnpromise !== null ? [cancelUnpromise] : []),
            ]);

      if (unblocker === queuePromise) {
        // resolve settlement
        const settlement = await queuePromise;
        // update unsettled job count
        unsettledJobs--;
        // cleanup job-specific cancelPromise references
        settlement.jobCancelPromise?.unsubscribe();

        // settlement resolved, return iteration step
        return {
          done: false,
          value: settlement,
        } satisfies IteratorResult<JobSettlement<J>>;
      } else if (unblocker === finalizeUnpromise && unsettledJobs > 0) {
        // launches finalized but jobs newly pending
        // recurse just once to wait again
        return promiseSettlementResult(queuePromise);
      }
    }

    // settlements finished, return iteration end
    return {
      done: true,
      value: undefined,
    } satisfies IteratorResult<JobSettlement<J>>;
  }

  return {
    launchJob(job: J) {
      // record that job is launched
      unsettledJobs++;

      const jobCancelOptions =
        cancelPromise !== null
          ? {
              // Optimisation. Create Unpromise up front for each job
              cancelPromise: Unpromise.resolve(cancelPromise),
            }
          : null;

      // call job
      const valuePromise = (
        jobCancelOptions !== null ? job(jobCancelOptions) : job()
      ) as Promise<Awaited<ReturnType<typeof job>>>;

      // launcher deliberately doesn't await completion of the job
      valuePromise
        .then((value) =>
          queue.send({
            job,
            status: "fulfilled",
            value,
            ...jobCancelOptions,
          })
        )
        .catch((reason) =>
          queue.send({
            job,
            status: "rejected",
            reason,
            ...jobCancelOptions,
          })
        );

      // fulfil immediately
      return voidPromise;
    },
    launchesDone() {
      launchesFinalized.flag();
    },
    async next() {
      // must eventually be awaited to avoid losing job settlement unless whole
      // strategy is cancelled and (hence) settlement iterator is ended
      const queuePromise = queue.receive();
      return promiseSettlementResult(queuePromise);
    },
  } satisfies Strategy<J>;
}
