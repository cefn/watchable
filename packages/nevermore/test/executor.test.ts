/* eslint-disable @typescript-eslint/promise-function-async */
import { describe, test, expect } from "vitest";
import { createExecutorStrategy } from "../../nevermore/src/executor";
import { sleep } from "../src";
describe("createExecutor ", () => {
  test("executor with no constraints execute like original operation", async () => {
    let pending = 0;
    const operation = async (n: number) => {
      pending++;
      try {
        await sleep(5);
        return { n, pending };
      } finally {
        pending--;
      }
    };

    // create executor operation
    const { createExecutor } = createExecutorStrategy({});
    const executor = createExecutor(operation);

    // play original operations
    let start = Date.now();
    const operationResults = await Promise.all([
      operation(0),
      operation(1),
      operation(2),
      operation(3),
    ]);
    expect(Date.now() - start).toBeLessThanOrEqual(10);

    // reset the sequence
    start = Date.now();
    const executorResults = await Promise.all([
      executor(0),
      executor(1),
      executor(2),
      executor(3),
    ]);
    expect(Date.now() - start).toBeLessThanOrEqual(10);

    expect(operationResults).toEqual(executorResults);
    expect(operationResults).toEqual([
      { n: 0, pending: 4 },
      { n: 1, pending: 3 },
      { n: 2, pending: 2 },
      { n: 3, pending: 1 },
    ]);
  });

  test("executor with concurrency constraint executes in series", async () => {
    // create operation and executor
    let pending = 0;
    const operation = async (n: number) => {
      pending++;
      try {
        await sleep(5);
        return { n, pending };
      } finally {
        pending--;
      }
    };
    const { createExecutor } = createExecutorStrategy({ concurrency: 1 });
    const executor = createExecutor(operation);

    // play original operations
    let start = Date.now();
    const operationResults = await Promise.all([
      operation(0),
      operation(1),
      operation(2),
      operation(3),
    ]);
    expect(Date.now() - start).toBeLessThanOrEqual(10);

    // reset the sequence
    start = Date.now();
    const executorResults = await Promise.all([
      executor(0),
      executor(1),
      executor(2),
      executor(3),
    ]);
    expect(Date.now() - start).toBeGreaterThanOrEqual(20);

    expect(operationResults).not.toEqual(executorResults);
    expect(executorResults).toEqual([
      { n: 0, pending: 1 },
      { n: 1, pending: 1 },
      { n: 2, pending: 1 },
      { n: 3, pending: 1 },
    ]);
  });

  test("executor with interval constraint is suitably delayed", async () => {
    // create operation and executor
    let pending = 0;
    const operation = async (n: number) => {
      pending++;
      try {
        await sleep(5);
        return { n, pending };
      } finally {
        pending--;
      }
    };
    const { createExecutor } = createExecutorStrategy({ intervalMs: 10 });
    const executor = createExecutor(operation);

    // play original operations
    let start = Date.now();
    const operationResults = await Promise.all([
      operation(0),
      operation(1),
      operation(2),
      operation(3),
    ]);
    expect(Date.now() - start).toBeLessThanOrEqual(10);

    // reset the sequence
    start = Date.now();
    const executorResults = await Promise.all([
      executor(0),
      executor(1),
      executor(2),
      executor(3),
    ]);
    expect(Date.now() - start).toBeGreaterThanOrEqual(30);

    expect(operationResults).not.toEqual(executorResults);
    expect(executorResults).toEqual([
      { n: 0, pending: 1 },
      { n: 1, pending: 1 },
      { n: 2, pending: 1 },
      { n: 3, pending: 1 },
    ]);
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
        createExecutor(operations[0]),
        createExecutor(operations[1]),
        createExecutor(operations[2]),
        createExecutor(operations[3]),
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
        createExecutor(operations[0]),
        createExecutor(operations[1]),
        createExecutor(operations[2]),
        createExecutor(operations[3]),
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
    async function slowOperation() {
      await sleep(20);
      return "foo";
    }

    test("executor with short timeout rejects slow operations", async () => {
      const { createExecutor } = createExecutorStrategy({ timeoutMs: 10 });
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
        expect(Date.now() - start).toBeLessThanOrEqual(15);

        expect(
          executorSettlements.every(
            (settlement) => settlement.status === "rejected"
          )
        );
      }
    });

    test("executor with long timeout resolves slow operations", async () => {
      const { createExecutor } = createExecutorStrategy({ timeoutMs: 30 });

      const patientExecutor = createExecutor(slowOperation);

      // original operations
      const start = Date.now();
      const executorSettlements = await Promise.allSettled([
        patientExecutor(),
        patientExecutor(),
        patientExecutor(),
        patientExecutor(),
      ]);
      expect(Date.now() - start).toBeGreaterThanOrEqual(20);

      expect(
        executorSettlements.map(
          (settlement) => settlement.status === "fulfilled" && settlement.value
        )
      ).toEqual(["foo", "foo", "foo", "foo"]);
    });
  });
});
