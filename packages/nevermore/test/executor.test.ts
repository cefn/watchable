/* eslint-disable @typescript-eslint/promise-function-async */
import { describe, test, expect } from "vitest";
import { createExecutorStrategy } from "../../nevermore/src/executor";
import { sleep } from "../src";
describe("createExecutor ", () => {
  describe("Scheduling constraint", () => {
    const TASK_DURATION = 5;

    // track task parallelism
    let pending = 0;

    const sleepingOperation = async (n: number) => {
      // register task
      pending++;
      try {
        await sleep(TASK_DURATION);
        return { n, pending };
      } finally {
        // unregister task
        pending--;
      }
    };

    test("executor with concurrency=1 constraint executes in series", async () => {
      const { createExecutor } = createExecutorStrategy({ concurrency: 1 });

      pending = 0;

      let start = Date.now();
      const unconstrainedResults = await Promise.all([
        sleepingOperation(0),
        sleepingOperation(1),
        sleepingOperation(2),
        sleepingOperation(3),
      ]);
      const unconstrainedDuration = Date.now() - start;

      const executor = createExecutor(sleepingOperation);

      start = Date.now();
      const constrainedResults = await Promise.all([
        executor(0),
        executor(1),
        executor(2),
        executor(3),
      ]);
      const constrainedDuration = Date.now() - start;

      expect(unconstrainedDuration).toBeLessThanOrEqual(TASK_DURATION * 2);
      expect(unconstrainedResults).toEqual([
        { n: 0, pending: 4 },
        { n: 1, pending: 3 },
        { n: 2, pending: 2 },
        { n: 3, pending: 1 },
      ]);

      expect(constrainedDuration).toBeGreaterThanOrEqual(TASK_DURATION * 4);
      expect(constrainedResults).toEqual([
        { n: 0, pending: 1 },
        { n: 1, pending: 1 },
        { n: 2, pending: 1 },
        { n: 3, pending: 1 },
      ]);
    });

    test("executor with interval constraint delays further executions", async () => {
      const { createExecutor } = createExecutorStrategy({
        intervalMs: TASK_DURATION * 2,
      });

      pending = 0;

      let start = Date.now();
      const unconstrainedResults = await Promise.all([
        sleepingOperation(0),
        sleepingOperation(1),
        sleepingOperation(2),
        sleepingOperation(3),
      ]);
      const unconstrainedDuration = Date.now() - start;

      const executor = createExecutor(sleepingOperation);

      start = Date.now();
      const constrainedResults = await Promise.all([
        executor(0),
        executor(1),
        executor(2),
        executor(3),
      ]);
      const constrainedDuration = Date.now() - start;

      expect(unconstrainedDuration).toBeLessThanOrEqual(TASK_DURATION * 2);
      expect(unconstrainedResults).toEqual([
        { n: 0, pending: 4 },
        { n: 1, pending: 3 },
        { n: 2, pending: 2 },
        { n: 3, pending: 1 },
      ]);

      expect(constrainedDuration).toBeGreaterThanOrEqual(TASK_DURATION * 4);
      expect(constrainedResults).toEqual([
        { n: 0, pending: 1 },
        { n: 1, pending: 1 },
        { n: 2, pending: 1 },
        { n: 3, pending: 1 },
      ]);
    });

    test("executor with no scheduling constraints executes like original operation", async () => {
      pending = 0;

      // create executor operation
      const { createExecutor } = createExecutorStrategy({});
      const executor = createExecutor(sleepingOperation);

      // play original operations
      let start = Date.now();
      const unconstrainedResults = await Promise.all([
        sleepingOperation(0),
        sleepingOperation(1),
        sleepingOperation(2),
        sleepingOperation(3),
      ]);
      expect(Date.now() - start).toBeLessThanOrEqual(TASK_DURATION * 2);

      // reset the sequence
      start = Date.now();
      const constrainedResults = await Promise.all([
        executor(0),
        executor(1),
        executor(2),
        executor(3),
      ]);
      expect(Date.now() - start).toBeLessThanOrEqual(TASK_DURATION * 2);

      expect(unconstrainedResults).toEqual(constrainedResults);
      expect(unconstrainedResults).toEqual([
        { n: 0, pending: 4 },
        { n: 1, pending: 3 },
        { n: 2, pending: 2 },
        { n: 3, pending: 1 },
      ]);
    });
  });

  describe("Retry", () => {
    const { createExecutor } = createExecutorStrategy({ retries: 2 });

    // factory for an operation which will fail a controllable number of times
    const createFailingOperation = (failuresEmulated: number) => {
      let failedAttempts = 0;

      return async (n: number) => {
        if (failedAttempts < failuresEmulated) {
          failedAttempts++;
          throw new Error("Job failed");
        }
        return n;
      };
    };

    test("executor with retry can try again and succeed", async () => {
      // TEST SETUP
      const FAILURES = 1;

      // CREATE OPERATIONS AND EXECUTORS
      const operations = [
        createFailingOperation(FAILURES),
        createFailingOperation(FAILURES),
        createFailingOperation(FAILURES),
        createFailingOperation(FAILURES),
      ];

      const executors = [
        createExecutor(createFailingOperation(FAILURES)),
        createExecutor(createFailingOperation(FAILURES)),
        createExecutor(createFailingOperation(FAILURES)),
        createExecutor(createFailingOperation(FAILURES)),
      ];

      // EXECUTE OPERATIONS AND EXECUTORS
      const operationSettlements = await Promise.allSettled(
        operations.map((operation, index) => operation(index))
      );

      const executorSettlements = await Promise.allSettled(
        executors.map((executor, index) => executor(index))
      );

      // CHECK RESULTS FROM OPERATIONS AND EXECUTORS

      // all operations will be run once
      // and will fail
      expect(
        operationSettlements.every(
          (settlement) => settlement.status === "rejected"
        )
      );

      // all executors will be run once (but underlying operation run twice)
      // and will therefore succeed
      expect(
        executorSettlements.every(
          (settlement) => settlement.status === "fulfilled"
        )
      );

      // check also for successful executor values
      expect(
        executorSettlements.map(
          (settlement) => settlement.status === "fulfilled" && settlement.value
        )
      ).toEqual([0, 1, 2, 3]);
    });

    test("executor with exhausted retries fails", async () => {
      // TEST SETUP
      const FAILURES = 2;

      const { createExecutor } = createExecutorStrategy({ retries: 2 });

      // CREATE OPERATIONS AND EXECUTORS
      const operations = [
        createFailingOperation(FAILURES),
        createFailingOperation(FAILURES),
        createFailingOperation(FAILURES),
        createFailingOperation(FAILURES),
      ];

      const executors = [
        createExecutor(createFailingOperation(FAILURES)),
        createExecutor(createFailingOperation(FAILURES)),
        createExecutor(createFailingOperation(FAILURES)),
        createExecutor(createFailingOperation(FAILURES)),
      ];

      // EXECUTE OPERATIONS AND EXECUTORS
      const operationSettlements = await Promise.allSettled(
        operations.map((operation, index) => operation(index))
      );

      const executorSettlements = await Promise.allSettled(
        executors.map((executor, index) => executor(index))
      );

      // CHECK RESULTS FROM OPERATIONS AND EXECUTORS

      // all operations will be run once
      // and will fail
      expect(
        operationSettlements.every(
          (settlement) => settlement.status === "rejected"
        )
      );

      // all executors will be run once (but underlying operation run twice)
      // and will therefore succeed
      expect(
        executorSettlements.every(
          (settlement) => settlement.status === "rejected"
        )
      );
    });
  });

  describe("Timeout", () => {
    const TASK_DURATION = 20;
    const TIMEOUT_IMPATIENCE = 10;
    const TIMEOUT_PATIENCE = 30;

    async function slowOperation() {
      await sleep(TASK_DURATION);
      return "foo";
    }

    test("executor with short timeout rejects slow operations", async () => {
      const { createExecutor } = createExecutorStrategy({
        timeoutMs: TIMEOUT_IMPATIENCE,
      });
      const impatientExecutor = createExecutor(slowOperation);

      {
        // original operations are slow
        const start = Date.now();
        const operationSettlements = await Promise.allSettled([
          slowOperation(),
          slowOperation(),
          slowOperation(),
          slowOperation(),
        ]);
        expect(Date.now() - start).toBeGreaterThanOrEqual(15);

        expect(
          operationSettlements.every(
            (settlement) => settlement.status === "fulfilled"
          )
        );
      }

      {
        // executor operations are rejected
        const start = Date.now();
        const executorSettlements = await Promise.allSettled([
          impatientExecutor(),
          impatientExecutor(),
          impatientExecutor(),
          impatientExecutor(),
        ]);
        expect(Date.now() - start).toBeLessThanOrEqual(
          TIMEOUT_IMPATIENCE * 1.5
        );

        expect(
          executorSettlements.every(
            (settlement) => settlement.status === "rejected"
          )
        );
      }
    });

    test("executor with long timeout resolves slow operations", async () => {
      const { createExecutor } = createExecutorStrategy({
        timeoutMs: TIMEOUT_PATIENCE,
      });

      const patientExecutor = createExecutor(slowOperation);

      // original operations
      const start = Date.now();
      const executorSettlements = await Promise.allSettled([
        patientExecutor(),
        patientExecutor(),
        patientExecutor(),
        patientExecutor(),
      ]);
      expect(Date.now() - start).toBeGreaterThanOrEqual(TASK_DURATION);

      expect(
        executorSettlements.map(
          (settlement) => settlement.status === "fulfilled" && settlement.value
        )
      ).toEqual(["foo", "foo", "foo", "foo"]);
    });
  });
});
