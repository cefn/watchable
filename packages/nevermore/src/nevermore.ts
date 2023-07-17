import { createQueue } from "@watchable/queue";
import type { Job, JobSettlement, Strategy } from "./types";
import { createAwaitable, pull, promiseMessage } from "./util";

/**
 *
 * @param jobs An array, generator or other Iterable. Nevermore will pull jobs from it just-in-time.
 * @param cancelPromise If provided, Nevermore will cease launching jobs whenever this promise settles.
 * @returns
 */
export async function* nevermore<T, J extends Job<T>>(options: {
  jobs: Iterable<J> | AsyncIterable<J> | (() => Generator<J>);
  cancelPromise?: Promise<unknown>;
}) {
  const { cancelPromise, jobs } = options;

  // if it's not an iterable, it's a zero-arg generator function
  // call generator to turn it into iterable
  const jobIterator =
    Symbol.iterator in jobs || Symbol.asyncIterator in jobs ? jobs : jobs();

  // queue used by concurrently executing jobs to notify outcomes
  const settlementQueue = createQueue<JobSettlement<T, J>>();

  let pendingJobCount = 0;
  const launchesDone = createAwaitable();

  // a coroutine for launching jobs which will notify queue
  async function* createSourceLaunches() {
    // generator only creates and launches next job
    // once next() is called on it
    for await (const job of jobIterator) {
      // background the job, tracking its pending status
      pendingJobCount++;
      void job()
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
    // launches are complete
    launchesDone.callback();
  }

  // define an async sequence of settlements
  async function* createSourceSettlements() {
    let settlementPromise = settlementQueue.receive();
    for (;;) {
      if (pendingJobCount === 0 && launchesDone.callback.invocation !== null) {
        return;
      }
      const racers: Array<Promise<"settlement" | "launchesDone" | "cancel">> = [
        promiseMessage(settlementPromise, "settlement"),
      ];
      if (launchesDone.callback.invocation === null) {
        racers.push(
          promiseMessage(launchesDone.callbackPromise, "launchesDone")
        );
      }
      if (cancelPromise !== undefined) {
        racers.push(promiseMessage(cancelPromise, "cancel"));
      }
      const winner = await Promise.race(racers);
      if (winner === "settlement") {
        yield await settlementPromise;
        // refresh settlement promise
        settlementPromise = settlementQueue.receive();
        continue;
      } else if (winner === "cancel") {
        return;
      }
    }
  }

  const sourceStrategy: Strategy<T, J> = {
    launches: createSourceLaunches(),
    settlements: createSourceSettlements(),
  };

  // Run background routine creating and launching jobs as fast as possible
  pull(sourceStrategy.launches, cancelPromise);

  yield* sourceStrategy.settlements;
}
