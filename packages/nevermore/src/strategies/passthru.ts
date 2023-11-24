import type {
  Job,
  LaunchesGenerator,
  Pipe,
  SettlementsGenerator,
  Strategy,
  StrategyFactory,
} from "../types";

export function createPassthruStrategy<J extends Job<unknown>>(
  downstream: Strategy<J>
) {
  async function* createLaunches(): LaunchesGenerator<J> {
    try {
      await downstream.launches.next(); // prime generator to yield point
      for (;;) {
        const job = yield;
        const launchResult = await downstream.launches.next(job);
        if (launchResult.done === true) {
          break;
        }
      }
    } finally {
      await downstream.launches.return();
    }
  }

  async function* createSettlements(): SettlementsGenerator<J> {
    try {
      for (;;) {
        const settlementResult = await downstream.settlements.next();
        if (settlementResult.done === true) {
          break;
        }
        yield settlementResult.value;
      }
    } finally {
      await downstream.settlements.return();
    }
  }

  return {
    launches: createLaunches(),
    settlements: createSettlements(),
  };
}

export function createPassthruPipe(): Pipe {
  return (createStrategy: StrategyFactory) =>
    <T, J extends Job<T>>() => {
      const downstream: Strategy<J> = createStrategy();
      return createPassthruStrategy<J>(downstream);
    };
}
