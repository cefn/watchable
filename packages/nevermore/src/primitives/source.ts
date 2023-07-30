import { createQueue } from "../../../queue/src/queue";
import type { Job, JobArgs, JobSettlement, Primitive } from "../types";
import { createAwaitableFlag, iterableToIterator, namedRace } from "../util";

export function createSourcePrimitive<T, J extends Job<T>>(options: {
  jobs:
    | Iterable<J>
    | AsyncIterable<J>
    | (() => Generator<J>)
    | (() => AsyncGenerator<J>);
  cancelPromise?: Promise<unknown>;
}) {
  const { jobs, cancelPromise = null } = options;

  // if it's not an iterable, it's a zero-arg (async?) generator function
  // call it to turn it into iterable
  const launchIterable =
    Symbol.iterator in jobs || Symbol.asyncIterator in jobs ? jobs : jobs();

  // queue used by concurrently executing jobs to notify outcomes
  const settlementQueue = createQueue<JobSettlement<T, J>>();

  let pendingJobCount = 0;
  const launchesDone = createAwaitableFlag();

  // a coroutine for launching jobs that will notify queue of their result
  // updates the launchesDone flag when it has exhausted all launches.
  async function* createSourceLaunches() {
    const launchIterator = iterableToIterator(launchIterable);
    const jobArgs: JobArgs = cancelPromise != null ? [{ cancelPromise }] : [];

    // (generator creates+launches next job when next() is called
    for (;;) {
      const nextLaunch = launchIterator.next();

      // optionally wait for cancelPromise in parallel
      if (cancelPromise !== null) {
        const winner = await namedRace({
          nextLaunch,
          cancelPromise,
        });
        if (winner === "cancelPromise") {
          // throw to terminate loop, probably running in background so not handled anywhere
          throw new Error(`Nevermore job sequence cancelled`);
        }
      }

      const { done, value } = await nextLaunch;
      if (done === true) {
        // no more launches will be yielded
        launchesDone.flag();
        return value;
      }
      // a further launch was yielded
      const job = value;

      // background the job, tracking its pending status
      pendingJobCount++;
      void job(...jobArgs)
        .then((value) => {
          // notify job success
          pendingJobCount--;
          settlementQueue.send({
            job,
            kind: "resolved",
            value,
          });
        })
        .catch((error) => {
          // notify job failure
          pendingJobCount--;
          settlementQueue.send({
            job,
            kind: "rejected",
            error,
          });
        });
      // yield job reference to caller
      yield job;
    }
  }

  // define an async sequence of settlements
  async function* createSourceSettlements() {
    let settlementPromise = settlementQueue.receive();

    for (;;) {
      // don't wait on launchesDone by default
      let launchesDonePromise: typeof launchesDone.promise | null = null;

      // check further settlements exhausted
      if (pendingJobCount === 0) {
        if (launchesDone.flagged) {
          // job iterator completed, all jobs have settled - finish
          return;
        }
        // wait on launchesDone - they may finish while we await a settlement that will never come
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

  const sourceStrategy: Primitive<T, J> = {
    launches: createSourceLaunches(),
    settlements: createSourceSettlements(),
  };

  return sourceStrategy;
}
