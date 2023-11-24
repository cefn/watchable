import type {
  Job,
  LaunchesGenerator,
  Pipe,
  SettlementsGenerator,
  Strategy,
  StrategyFactory,
} from "../types";

export function createPassthruStrategy<T, J extends Job<T>>(
  downstream: Strategy<T, J>
) {
  async function* createLaunches(): LaunchesGenerator<T, J> {
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

  async function* createSettlements(): SettlementsGenerator<T, J> {
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
      const downstream: Strategy<T, J> = createStrategy();
      return createPassthruStrategy<T, J>(downstream);
    };
}
