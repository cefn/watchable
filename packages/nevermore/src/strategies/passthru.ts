/* eslint-disable @typescript-eslint/promise-function-async */
import type { Job, Pipe, Strategy, StrategyFactory } from "../types";

export function createPassthruStrategy<J extends Job<unknown>>(
  downstream: Strategy<J>
) {
  return {
    launchJob(job) {
      return downstream.launchJob(job);
    },
    launchesDone() {
      downstream.launchesDone();
    },
    next() {
      return downstream.next();
    },
  } satisfies Strategy<J>;
}

export function createPassthruPipe(): Pipe {
  return (createStrategy: StrategyFactory) =>
    <J extends Job<unknown>>() =>
      createPassthruStrategy<J>(createStrategy<J>());
}
