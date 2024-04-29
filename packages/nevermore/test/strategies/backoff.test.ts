import { describe, beforeEach, afterEach, test, expect, vi } from "vitest";

import {
  createExecutorStrategy,
  createSettlementSequence,
  sleep,
} from "../../src/index";
import { Job, JobSettlement } from "../../src/types";

/** Creates an expected sequence of backoff delays for given
 * options (after `backoffCeiling` repetitions the delay is constant) */
export function predictBackoffSequence(options: {
  backoffMs: number;
  backoffGrowth: number;
  backoffCeiling: number;
}) {
  const { backoffMs, backoffGrowth, backoffCeiling } = options;

  return Array.from({
    length: backoffCeiling,
  }).map((_, iteration) =>
    iteration === 0 ? 0 : backoffMs * Math.pow(backoffGrowth, iteration - 1)
  );
}

/** Define an operation to emulate failure while recording timestamps and
 * results to support test assertions */
function createTestModel(
  options: Partial<{
    durationMs: number;
    emulateFailures: number;
  }>
) {
  const { durationMs = 0, emulateFailures = 0 } = options;

  // record the operations executed in this model
  let count = 0;
  const records: OperationRecord[] = [];

  // this function is called as the operation
  async function operation() {
    // check if outcome should be return or throw
    const attempt = ++count;
    const outcome = count <= emulateFailures ? "Failure" : "Success";

    // some operations take time
    if (durationMs > 0) {
      await sleep(durationMs);
    }

    // record the outcome with completion timestamp
    const timestamp = new Date().getTime();
    records.push({
      attempt,
      timestamp,
      outcome,
    });

    // return or throw
    if (outcome === "Success") {
      return outcome;
    }
    throw new Error(outcome);
  }

  // return state from the closure for assertions
  function getAttempts() {
    return {
      count,
      records,
    };
  }

  // return test model
  return {
    operation,
    getAttempts,
  };
}

/** A record of a single call to an operation */
interface OperationRecord {
  attempt: number;
  timestamp: number;
  outcome: "Success" | "Failure";
}

/** Add a delay value, calculated relative to the timestamp of the previous record. */
function calculateOffsets(records: { timestamp: number }[]) {
  let previous = NaN;
  return records.map((record) => {
    const offset = Number.isNaN(previous) ? NaN : record.timestamp - previous;
    previous = record.timestamp;
    return offset;
  });
}

describe("Backoff retry behaviour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Backoff timing", () => {
    const TEST_BACKOFF_MS = 50; // initial backoff under test

    const TEST_BACKOFF_SEQUENCE = Object.freeze([
      0, 50, 100, 200, 400, 800, 1600, 3200, 6400, 12800,
    ]); //predictBackoffSequence({ backoffMs: 50, backoffGrowth: 2, backoffCeiling: 10, });

    test("Executor backs off exponentially until eventual success", async () => {
      // create a scheduler, returning the wrapper function
      const { createExecutor } = createExecutorStrategy({
        backoffMs: TEST_BACKOFF_MS,
        backoffJitter: 0, //ensure timing is deterministic
      });

      // create an operation that records attempts
      const { operation, getAttempts } = createTestModel({
        emulateFailures: 9,
      });

      // wrap the operation to create an executor (scheduled operation)
      const testExecutor = createExecutor(operation);

      // invoke executor to promise an eventually-successful operation
      const resultPromise = testExecutor();

      const TENTH_BACKOFF_MS = TEST_BACKOFF_SEQUENCE.reduce(
        (acc, val) => acc + val
      ); // cumulative number of milliseconds to reach 10th backoff retry

      // advance the fake timers to the millisecond before completion
      await vi.advanceTimersByTimeAsync(TENTH_BACKOFF_MS - 1);

      // 9 failures should have taken place
      expect(getAttempts().count).toBe(9);
      expect(
        getAttempts().records.every(({ outcome }) => outcome === "Failure")
      );

      // advance one more millisecond
      await vi.advanceTimersByTimeAsync(1);

      // the 10th should have been scheduled, and be a success
      expect(getAttempts().count).toBe(10);
      expect(await resultPromise).toBe("Success");

      // offset between calls align with the schedule
      expect(calculateOffsets(getAttempts().records)).toEqual([
        NaN,
        50,
        100,
        200,
        400,
        800,
        1600,
        3200,
        6400,
        12800,
      ]);
    });

    test("Executor resumes executing with no delay after one success", async () => {
      // create a scheduler, returning the wrapper function
      const { createExecutor } = createExecutorStrategy({
        backoffMs: TEST_BACKOFF_MS,
        backoffJitter: 0, //ensure timing is deterministic
      });

      // create an operation that records attempts
      const { operation, getAttempts } = createTestModel({
        emulateFailures: 2,
      });

      // wrap the operation to create an executor (scheduled operation)
      const testExecutor = createExecutor(operation);

      // invoke executor which will complete only after failures have finished
      const firstSuccessPromise = testExecutor();
      await vi.runAllTimersAsync();

      // invoke executor again now all failures are over
      const secondSuccessPromise = testExecutor();
      await vi.runAllTimersAsync();

      // both invocations were eventually successful
      expect(
        await Promise.all([firstSuccessPromise, secondSuccessPromise])
      ).toEqual(["Success", "Success"]);

      // calculate delays
      const offsets = calculateOffsets(getAttempts().records);
      expect(offsets).toEqual([NaN, 50, 100, 0]);

      // expect last delay to be 0 (no further backoff after a success)
      const lastOffset = offsets[offsets.length - 1];
      expect(lastOffset).toEqual(0);
    });

    test("Scheduling noise is added by backoffJitter", async () => {
      const modelNoJitter = createTestModel({
        emulateFailures: 4,
      });

      // execute sequence of failing operations without backoffJitter
      const { createExecutor: createExecutorNoJitter } = createExecutorStrategy(
        {
          backoffMs: 5,
          backoffJitter: 0,
        }
      );
      const executorNoJitter = createExecutorNoJitter(modelNoJitter.operation);
      const resultPromiseNoJitter = executorNoJitter();
      await vi.runAllTimersAsync();
      expect(await resultPromiseNoJitter).toBe("Success");
      const offsetsNoJitter = calculateOffsets(
        modelNoJitter.getAttempts().records
      );
      expect(offsetsNoJitter).toEqual([NaN, 5, 10, 20, 40]);

      // replay the sequence WITH jitter
      // delays should not be equal
      const modelWithJitter = createTestModel({
        emulateFailures: 4,
      });
      const { createExecutor: createExecutorWithJitter } =
        createExecutorStrategy({
          backoffMs: 5,
          backoffJitter: 0.5,
        });
      const executorWithJitter = createExecutorWithJitter(
        modelWithJitter.operation
      );
      const resultPromiseWithJitter = executorWithJitter();
      await vi.runAllTimersAsync();
      expect(await resultPromiseWithJitter).toBe("Success");
      const offsetsWithJitter = calculateOffsets(
        modelWithJitter.getAttempts().records
      );
      expect(offsetsWithJitter).not.toEqual(offsetsNoJitter);
    });

    test("backoffMaxExponent limits growth of backoff delay", async () => {
      const backoffMaxExponent = 2;
      const backoffMs = 1;
      const backoffJitter = 0; // make deterministic
      const { operation, getAttempts } = createTestModel({
        emulateFailures: 4,
      });

      // execute sequence of failing operations without backoffJitter
      const { createExecutor } = createExecutorStrategy({
        backoffMs,
        backoffMaxExponent,
        backoffJitter,
      });
      // run until eventual success
      const executor = createExecutor(operation);
      const resultPromise = executor();
      await vi.runAllTimersAsync();
      // expect failure backoffs to have been exponential then flat
      expect(await resultPromise).toBe("Success");
      const offsets = calculateOffsets(getAttempts().records);
      expect(offsets).toEqual([NaN, 1, 2, 4, 4]);
    });
  });

  describe("Strategy compatibility", () => {
    describe("backoff with concurrency", () => {
      test("backoff and concurrent execution (concurrency>1) are compatible", async () => {
        const durationMs = 5;
        const concurrency = 4;
        const { operation, getAttempts } = createTestModel({
          durationMs,
        });
        const { createExecutor } = createExecutorStrategy({
          backoffMs: Number.MAX_SAFE_INTEGER,
          concurrency,
        });
        const executor = createExecutor(operation);
        // execute 4 times concurrently
        const resultsPromise = Promise.all([
          executor(),
          executor(),
          executor(),
          executor(),
        ]);
        // expect all tasks to have completed in parallel (one duration)
        await vi.advanceTimersByTimeAsync(durationMs);
        // results are successful
        expect(await resultsPromise).toEqual([
          "Success",
          "Success",
          "Success",
          "Success",
        ]);
        // expect no delay between task completion timings
        expect(calculateOffsets(getAttempts().records)).toEqual([NaN, 0, 0, 0]);
      });

      test("backoff and sequential execution (concurrency=1) are compatible", async () => {
        const durationMs = 5;
        const concurrency = 1;
        const { operation, getAttempts } = createTestModel({
          durationMs,
        });
        const { createExecutor } = createExecutorStrategy({
          backoffMs: Number.MAX_SAFE_INTEGER,
          concurrency,
        });
        const executor = createExecutor(operation);

        // execute 4 times sequentially
        const resultsPromise = Promise.all([
          executor(),
          executor(),
          executor(),
          executor(),
        ]);
        // expect all tasks to have completed in sequence (four durations)
        await vi.advanceTimersByTimeAsync(durationMs * 4);

        // results are successful
        expect(await resultsPromise).toEqual([
          "Success",
          "Success",
          "Success",
          "Success",
        ]);
        // expect 5 millisecond delay between completion of operations
        expect(calculateOffsets(getAttempts().records)).toEqual([NaN, 5, 5, 5]);
      });

      test("jobs in backoff count as pending, consume a concurrency slot", async () => {
        const durationMs = 5;
        const concurrency = 1;
        const backoffMs = 200;

        const { operation, getAttempts } = createTestModel({
          durationMs,
          emulateFailures: 1,
        });
        const { createExecutor } = createExecutorStrategy({
          backoffMs,
          backoffJitter: 0,
          concurrency,
        });
        const executor = createExecutor(operation);

        // execute 4 times sequentially
        const resultPromise1 = executor();
        const resultPromise2 = executor();
        const resultPromise3 = executor();
        const resultPromise4 = executor();

        // expect all tasks to have completed in sequence (four durations)
        await vi.runAllTimersAsync();

        // results are successful
        const returnValues = await Promise.all([
          resultPromise1,
          resultPromise2,
          resultPromise3,
          resultPromise4,
        ]);

        expect(returnValues).toEqual([
          "Success",
          "Success",
          "Success",
          "Success",
        ]);

        // expect 5 attempts to have been made and the first failure
        // delaying all the others
        expect(getAttempts().records.map(({ outcome }) => outcome)).toEqual([
          "Failure",
          "Success",
          "Success",
          "Success",
          "Success",
        ]);

        //The first attempt was a failure after NaN offset (no previous timestamp)
        //The next attempt was already scheduled after settlement of first attempt
        //and before backoff delay was changed.
        //Next attempt had a backoff
        expect(calculateOffsets(getAttempts().records)).toEqual([
          NaN,
          5,
          200,
          5,
          5,
        ]);
      });
    });

    describe("backoff with rate", () => {
      test("rate-limit functional if backoff not triggered", async () => {
        const intervalMs = 10;
        const durationMs = 3;

        // configure operation with a delay but no failures
        const { operation, getAttempts } = createTestModel({
          durationMs,
        });

        // create executor with backoff and rate
        const { createExecutor } = createExecutorStrategy({
          intervalMs,
          backoffMs: Number.MAX_SAFE_INTEGER,
          backoffJitter: 0,
        });
        const executor = createExecutor(operation);

        // schedule operations, promising future results
        const resultPromises = [executor(), executor(), executor()];

        // advance through completion of each operation (1 per interval)
        expect(getAttempts().records.length).toBe(0);
        await vi.advanceTimersByTimeAsync(durationMs); // first task completion
        expect(getAttempts().records.length).toBe(1);
        await vi.advanceTimersByTimeAsync(intervalMs); // rate-limited delay
        expect(getAttempts().records.length).toBe(2);
        await vi.advanceTimersByTimeAsync(intervalMs); // rate-limited delay
        expect(getAttempts().records.length).toBe(3);

        // expect successful execution
        expect(await Promise.all(resultPromises)).toEqual([
          "Success",
          "Success",
          "Success",
        ]);
      });

      test("rate-limit functional if backoff is triggered", async () => {
        const intervalMs = 10;
        const durationMs = 3;

        // configure operation with a delay but no failures
        const { operation, getAttempts } = createTestModel({
          durationMs,
          emulateFailures: 2,
        });

        // create executor with backoff and rate
        const { createExecutor } = createExecutorStrategy({
          intervalMs,
          backoffMs: 50,
          backoffJitter: 0,
        });
        const executor = createExecutor(operation);

        // schedule operations, promising future results
        const resultPromises = [executor(), executor(), executor(), executor()];

        await vi.runAllTimersAsync();

        expect(calculateOffsets(getAttempts().records)).toEqual([
          NaN, // attempt fails, first timestamp is written, (no previous timestamp so no offset)
          10, // attempt already scheduled before failure modified backoff and hits second failure
          50, // third attempt had backoff set after first failure
          100, // fourth attempt had backoff doubled after second failure
          10, // success returns backoff to 0 - rate-limit-constrained execution
          10, // rate-limit constrained execution
        ]);

        expect(await Promise.all(resultPromises)).toEqual([
          "Success",
          "Success",
          "Success",
          "Success",
        ]);
      });
    });

    describe("backoff with retry", () => {
      test("job fails if retries are exhausted", async () => {
        const backoffMs = 10;
        const backoffJitter = 0;
        const retries = 4;
        const { operation, getAttempts } = createTestModel({
          emulateFailures: Number.POSITIVE_INFINITY,
        });
        const { createExecutor } = createExecutorStrategy({
          backoffMs,
          backoffJitter,
          retries,
        });

        const executor = createExecutor(operation);

        const resultPromise = executor();
        const resultExpectation = expect(() => resultPromise).rejects.toEqual(
          new Error("Failure")
        );

        await vi.runAllTimersAsync();
        await resultExpectation;

        expect(calculateOffsets(getAttempts().records)).toEqual([
          NaN, // first had no previous to calculate offset
          10, // second was executed after backoff
          20, // third was executed after backoff * 2
          40, // third was executed after backoff * 4
        ]);
      });

      test("job succeeds if retries not exhausted ", async () => {
        const backoffMs = 10;
        const backoffJitter = 0;
        const retries = 5;
        const { operation, getAttempts } = createTestModel({
          emulateFailures: 4,
        });
        const { createExecutor } = createExecutorStrategy({
          backoffMs,
          backoffJitter,
          retries,
        });

        const executor = createExecutor(operation);

        const resultPromise = executor();

        await vi.runAllTimersAsync();
        expect(await resultPromise).toBe("Success");

        expect(calculateOffsets(getAttempts().records)).toEqual([
          NaN,
          10,
          20,
          40,
          80, // eventually successful
        ]);
      });
    });

    describe("backoff with timeout", () => {
      test("timeout triggers backoff state", async () => {
        const durationMs = 99;
        const concurrency = 1;
        const intervalMs = 50;
        const timeoutMs = 199;
        const backoffMs = 500;
        const backoffJitter = 0; // make deterministic

        const { operation: shortOperation } = createTestModel({
          durationMs,
        });

        const { operation: longOperation } = createTestModel({
          durationMs: timeoutMs * 2,
        });

        async function* createOperationSequence() {
          yield Object.assign(() => shortOperation(), { id: "normal" });

          let ranLong = false;
          yield Object.assign(
            () => {
              if (!ranLong) {
                ranLong = true;
                return longOperation();
              }
              return shortOperation();
            },
            { id: "long" }
          );

          yield Object.assign(() => shortOperation(), { id: "normal-again" });
        }

        const operations = createOperationSequence();

        const settlements = createSettlementSequence(
          {
            concurrency,
            intervalMs,
            timeoutMs,
            backoffMs,
            backoffJitter,
          },
          operations
        );

        // background function pulling settlements immediately for accurate timings
        async function promiseTimedSettlements() {
          const records: {
            settlement: JobSettlement<Job<unknown> & { id: string }>;
            timestamp: number;
          }[] = [];
          for await (const settlement of settlements) {
            records.push({
              settlement,
              timestamp: new Date().getTime(),
            });
          }
          return records;
        }

        const timedSettlementsPromise = promiseTimedSettlements();
        await vi.runAllTimersAsync();
        const timedSettlements = await timedSettlementsPromise;

        expect(
          timedSettlements.map(({ settlement }) => settlement.job.id)
        ).toEqual([
          "normal", // complete first job (normal)
          "normal-again", // complete third job (normal) overtook long job
          "long", // long job experienced a timeout and a backoff
        ]);
        expect(calculateOffsets(timedSettlements)).toEqual([
          NaN, // first job (normal) took 99 duration (no previous offset)
          298, // third job (normal) got third slot after long job's 199 timeout, took 99 duration
          500, // second job (long) rescheduled immediately after its 199 timeout, took 99 duration, delayed by 500ms backoff
        ]);
      });
    });
  });

  describe("BackoffOptions validation", () => {
    test("Other backoff options are invalid unless backoffMs is set", async () => {
      for (const optionName of [
        "backoffGrowth",
        "backoffMaxExponent",
        "backoffJitter",
      ]) {
        expect(() => createExecutorStrategy({ [optionName]: 42 }))
          .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid BackoffOptions: [
          ${optionName} is not valid without backoffMs
          ]]
        `);
      }
    });

    test("backoffGrowth is bounded to required range", async () => {
      expect(() => createExecutorStrategy({ backoffMs: 101, backoffGrowth: 0 }))
        .toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid BackoffOptions: [
        Option backoffGrowth cannot be below 1
        ]]
      `);
    });

    test("backoffCeiling is bounded to required range", async () => {
      expect(() =>
        createExecutorStrategy({ backoffMs: 101, backoffMaxExponent: 0 })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid BackoffOptions: [
        Option backoffMaxExponent cannot be below 1
        ]]
      `);
    });

    test("backoffJitter is bounded to required range", async () => {
      expect(() =>
        createExecutorStrategy({ backoffMs: 101, backoffJitter: -0.1 })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid BackoffOptions: [
        Option backoffJitter cannot be below 0
        ]]
      `);
      expect(() =>
        createExecutorStrategy({ backoffMs: 101, backoffJitter: 1.1 })
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: backoffJitter cannot be greater than 1]`
      );
    });
  });
});
