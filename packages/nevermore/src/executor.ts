/* eslint-disable @typescript-eslint/promise-function-async */
import { type Job, type NevermoreOptions, createStrategyFromOptions } from ".";

type ExecutorJob<T> = Job<T> & {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

/** Given an existing typed operation, returns an identically-typed operation
 * that schedules its execution within a nevermore pipeline, configured with
 * the provided options.
 *
 * For example...
 * * concurrency, rate-limits: executors will delay if other executors are
 *   already using the capacity
 * * timeout : if the underlying operation takes too long, the executor will
 *   throw a timeout error
 * * retry : the underlying operation is retried and the executor only throws
 *   when retries are exhausted
 * @param options
 * @returns
 */
export function createExecutorStrategy(options: NevermoreOptions) {
  /** Create a pipeline to limit arbitrary jobs according to the provided options. */
  const strategy = createStrategyFromOptions<ExecutorJob<any>>(options);

  /** Create type-safe substitute for `op` that executes it in the strategy
   * pipeline associating callbacks that settle eventual result for original caller. */
  function createExecutor<Args extends unknown[], Ret>(
    op: (...args: Args) => Promise<Ret>
  ) {
    return ((...args: Args) =>
      new Promise((resolve, reject) => {
        // job executes op with args from closure
        const job = () => op(...args);
        // annotate job with awaited Promise's `resolve` and `reject` to notify eventual settlement
        const executorJob = Object.assign(job, {
          resolve,
          reject,
        });
        // request job launch (mediated by e.g. concurrency, rate etc.)
        void strategy.launchJob(executorJob);
      })) satisfies typeof op;
  }

  /** Create a routine that consumes the eventual settlement of each ExecutorJob
   * resolving or rejecting to notify the original caller of the result.
   */
  async function pullSettlements() {
    for (;;) {
      // block for next settlement or end
      const result = await strategy.next();
      // all settlements have ended
      if (result.done === true) {
        break;
      }
      // there's a further settlement
      const settlement = result.value;
      if (settlement.status === "fulfilled") {
        // operation is fulfilled
        const {
          job: { resolve },
          value,
        } = settlement;

        // resolve for original caller
        resolve(value);
      } else {
        // operation is failed
        const {
          job: { reject },
          reason,
        } = settlement;

        // reject for original caller
        reject(reason);
      }
    }
  }

  // launch background routine to consume and settle results as they arrive
  // (routine is halted by calling launchesDone() to terminate the executor strategy)
  void pullSettlements();

  return {
    createExecutor,
  };
}
