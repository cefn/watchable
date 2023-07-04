import { describe, expect, test } from "vitest";
import { nevermore, type NevermoreOptions } from "../../src";
import { createFailingJob, iterable2array } from "../testutil";

describe("Retry behaviour", () => {
  test("Can retry failed tasks", async () => {
    const settlementSequence = nevermore({ retries: 1 }, function* () {
      yield Object.assign(createFailingJob({ failures: 1 }), { taskId: 0 });
      yield Object.assign(createFailingJob({ failures: 1 }), { taskId: 1 });
      yield Object.assign(createFailingJob({ failures: 1 }), { taskId: 2 });
    });

    const settlements = await iterable2array(settlementSequence);

    expect(settlements.every(({ status }) => status === "fulfilled"));
    expect(settlements.length).toBe(3);
  });

  test("Tasks exhausting retries settle as failed", async () => {
    const settlementSequence = nevermore({ retries: 1 }, function* () {
      yield Object.assign(createFailingJob({ failures: 2 }), { taskId: 0 }); // fails all retries
      yield Object.assign(createFailingJob({ failures: 1 }), { taskId: 1 });
      yield Object.assign(createFailingJob({ failures: 1 }), { taskId: 2 });
    });

    const settlements = await iterable2array(settlementSequence);

    expect(settlements.map(({ status }) => status)).toMatchObject([
      "rejected",
      "fulfilled",
      "fulfilled",
    ]);
    expect(settlements.length).toBe(3);
  });

  test("Retries are also limited by concurrency", async () => {
    const nevermoreOptions: NevermoreOptions = {
      retries: 1,
      concurrency: 1,
    };
    const failureOptions = {
      failures: 1,
      delayMs: 10,
    };

    const settlementSequence = nevermore(nevermoreOptions, function* () {
      yield Object.assign(createFailingJob(failureOptions), {
        taskId: 0,
      });
      yield Object.assign(createFailingJob(failureOptions), {
        taskId: 1,
      });
      yield Object.assign(createFailingJob(failureOptions), {
        taskId: 2,
      });
    });

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(6 * failureOptions.delayMs);

    expect(settlements.map(({ status }) => status)).toMatchObject([
      "fulfilled",
      "fulfilled",
      "fulfilled",
    ]);
    expect(settlements.length).toBe(3);
  });

  test("Retries are also limited by rate limit", async () => {
    const nevermoreOptions = {
      retries: 1,
      intervalMs: 10,
      intervalSlots: 1,
    } satisfies NevermoreOptions;

    const failureOptions = {
      failures: 1,
      delayMs: 1,
    };

    const settlementSequence = nevermore(nevermoreOptions, function* () {
      yield Object.assign(createFailingJob(failureOptions), {
        taskId: 0,
      });
      yield Object.assign(createFailingJob(failureOptions), {
        taskId: 1,
      });
      yield Object.assign(createFailingJob(failureOptions), {
        taskId: 2,
      });
    });

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    // Final job completes at beginning of 6th 10ms interval (e.g. ~50 ms)
    expect(duration).toBeGreaterThanOrEqual(5 * nevermoreOptions.intervalMs);
    expect(duration).toBeLessThanOrEqual(7 * nevermoreOptions.intervalMs);

    expect(settlements.map(({ status }) => status)).toMatchObject([
      "fulfilled",
      "fulfilled",
      "fulfilled",
    ]);
    expect(settlements.length).toBe(3);
  });
});
