import { createQueue } from "../../../queue/src/queue";
import type {
  CancelOptions,
  Job,
  JobArgs,
  JobSettlement,
  Feed,
} from "../types";
import { createAwaitableFlag, namedRace } from "../util";

/** Creates a Feed that accepts jobs  */
export function createSourceFeed<T, J extends Job<T>>(
  options: Partial<CancelOptions>
) {
  const { cancelPromise = null } = options;

  const jobArgs: JobArgs = cancelPromise != null ? [{ cancelPromise }] : [];

  // flag to track when launch iteration has finished
  const launchesDone = createAwaitableFlag();
  // count to track when settlement iteration has finished)
  let pendingJobCount = 0;
  // queue used by concurrently executing jobs to notify outcomes
  const settlementQueue = createQueue<JobSettlement<T, J>>();

  async function launchJob(job: J) {
    pendingJobCount++;
    try {
      const value = await job(...jobArgs);
      // notify job success
      pendingJobCount--;
      settlementQueue.send({
        job,
        kind: "resolved",
        value,
      });
    } catch (error) {
      // notify job failure
      pendingJobCount--;
      settlementQueue.send({
        job,
        kind: "rejected",
        error,
      });
    }
  }

  // a coroutine for launching jobs that will notify queue of their result
  // updates the launchesDone flag when it has exhausted all launches.
  async function* createLaunches(): AsyncGenerator<void, void, J> {
    // (generator creates+launches next job when next() is called
    try {
      for (;;) {
        // a job was yielded to be launched
        const job = yield;
        // background the job, (will eventually notify result to queue)
        void launchJob(job);
      }
    } finally {
      launchesDone.flag();
    }
  }

  // define an async sequence of settlements
  async function* createSettlements() {
    let settlementPromise = settlementQueue.receive();

    for (;;) {
      // don't wait on launchesDone by default
      let launchesDonePromise: typeof launchesDone.promise | null = null;

      // check further settlements exhausted
      if (pendingJobCount === 0) {
        if (launchesDone.flagged) {
          // no more settlements, no more launches - iteration has finished
          return;
        }
        // wait on launchesDone, else launches may finish while we await a settlement that will never come
        launchesDonePromise = launchesDone.promise;
      }

      if (launchesDonePromise !== null || cancelPromise !== null) {
        const winner = await namedRace({
          settlementPromise,
          // wait on launchesDonePromise (pendingJobCount was 0 and may never increment)
          ...(launchesDonePromise !== null && { launchesDonePromise }),
          // wait on cancelPromise (provided by original caller)
          ...(cancelPromise !== null && { cancelPromise }),
        });
        if (winner === "cancelPromise") {
          // caller requested early termination
          throw new Error(`Nevermore job sequence cancelled`);
        }
        if (winner === "launchesDonePromise") {
          // check again if any future settlements are pending
          continue;
        }
      }
      // yield settled result
      yield await settlementPromise;
      // refresh settlement promise
      settlementPromise = settlementQueue.receive();
    }
  }

  const sourceFeed: Feed<T, J> = {
    launches: createLaunches(),
    settlements: createSettlements(),
  };

  return sourceFeed;
}
