import { createQueue } from "../../../queue/src/queue";
import type { Job, JobArgs, JobSettlement, Primitive } from "../types";
import {
  createAwaitableFlag,
  iterableToIterator,
  promiseMessage,
} from "../util";

export function createSourcePrimitive<T, J extends Job<T>>(options: {
  jobs:
    | Iterable<J>
    | AsyncIterable<J>
    | (() => Generator<J>)
    | (() => AsyncGenerator<J>);
  cancelPromise?: Promise<unknown>;
}) {
  const { cancelPromise, jobs } = options;

  const cancelMessagePromise =
    cancelPromise === undefined
      ? null
      : promiseMessage(cancelPromise, "cancel");

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
    const jobArgs: JobArgs =
      cancelPromise !== undefined ? [{ cancelPromise }] : [];

    // (generator creates+launches next job when next() is called
    for (;;) {
      const launchPromise = launchIterator.next();
      let launchIteratorResult: IteratorResult<J> | "cancel";

      // optionally wait for cancelPromise in parallel
      if (cancelMessagePromise !== null) {
        launchIteratorResult = await Promise.race([
          launchPromise,
          cancelMessagePromise,
        ]);
        if (launchIteratorResult === "cancel") {
          // error terminates loop. Probably not handled anywhere given it's running in background
          throw new Error(`Nevermore job sequence cancelled`);
        }
      } else {
        launchIteratorResult = await launchPromise;
      }

      // wasn't cancelled, so destructure result
      const { done, value } = launchIteratorResult;

      if (done === true) {
        // launches are complete
        launchesDone.flag();
        return;
      }
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

    const cancelMessagePromiseList =
      cancelMessagePromise === null ? [] : [cancelMessagePromise];

    for (;;) {
      // check there are further settlements to await
      if (launchesDone.flagged && pendingJobCount === 0) {
        // job iterator completed, all jobs have settled - finish
        return;
      }

      // add launchesDone to monitored conditions (if not flagged since last cycle)
      const launchesDonePromiseList = launchesDone.flagged
        ? []
        : [promiseMessage(launchesDone.promise, "launchesDone")];

      // wait for all possible termination conditions
      const winner = await Promise.race([
        // wait for settlement
        promiseMessage(settlementPromise, "settlement"),
        // wait for launchesDone (unless already fired)
        ...launchesDonePromiseList,
        // wait for cancel (if caller provided cancelPromise)
        ...cancelMessagePromiseList,
      ]);

      // either...
      // * yield settled result
      // * implicitly reset promise (no longer wait for launches to finish)
      // * finalise with cancellation
      if (winner === "settlement") {
        yield await settlementPromise;
        // refresh settlement promise
        settlementPromise = settlementQueue.receive();
        continue;
      } else if (winner === "cancel") {
        // caller requested early termination
        throw new Error(`Nevermore job sequence cancelled`);
      }
    }
  }

  const sourceStrategy: Primitive<T, J> = {
    launches: createSourceLaunches(),
    settlements: createSourceSettlements(),
  };

  return sourceStrategy;
}
