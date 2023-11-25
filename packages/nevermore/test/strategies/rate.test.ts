import { beforeEach, describe, expect, test } from "vitest";
import {
  nevermore,
  sleep,
  type RateOptions,
  type ConcurrencyOptions,
} from "../../src";
import { iterable2array } from "../testutil";

describe("Rate limits: ", () => {
  const TASK_DELAY = 5;
  const TASK_COUNT = 4;

  type TaskEvent = [string, { pending: number }];
  let events: TaskEvent[] = [];
  let pending = 0;

  beforeEach(() => {
    events = [];
    pending = 0;
  });

  async function* taskGenerator() {
    for (let taskId = 0; taskId < TASK_COUNT; taskId++) {
      events.push([`Creating task ${taskId}`, { pending }]);
      yield Object.assign(
        async () => {
          const startMs = Date.now();
          events.push([`Starting task ${taskId}`, { pending: ++pending }]);
          await sleep(TASK_DELAY);
          events.push([`Stopping task ${taskId}`, { pending: --pending }]);
          return `Duration: ${Date.now() - startMs}`;
        },
        { taskId }
      );
    }
  }

  test("infinite slots - 4 tasks run in parallel", async () => {
    const rateOptions: RateOptions = {
      intervalMs: 1000, // irrelevant but required
      intervalSlots: Number.MAX_SAFE_INTEGER,
    };

    const settlementSequence = nevermore(rateOptions, taskGenerator);

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(events).toMatchObject([
      ["Creating task 0", { pending: 0 }],
      ["Starting task 0", { pending: 1 }],
      ["Creating task 1", { pending: 1 }],
      ["Starting task 1", { pending: 2 }],
      ["Creating task 2", { pending: 2 }],
      ["Starting task 2", { pending: 3 }],
      ["Creating task 3", { pending: 3 }],
      ["Starting task 3", { pending: 4 }],
      ["Stopping task 0", { pending: 3 }],
      ["Stopping task 1", { pending: 2 }],
      ["Stopping task 2", { pending: 1 }],
      ["Stopping task 3", { pending: 0 }],
    ]);

    expect(Math.max(...events.map(([, { pending }]) => pending))).toBe(
      TASK_COUNT
    );

    expect(duration).toBeGreaterThanOrEqual(TASK_DELAY - 1);
    expect(duration).toBeLessThan(TASK_DELAY * 2);
    expect(settlements.length).toBe(TASK_COUNT);
  });

  test("{ intervalMs: 10, intervalSlots: 1 } - 4 tasks run in series", async () => {
    const rateOptions: RateOptions = { intervalMs: 10, intervalSlots: 1 };
    const settlementSequence = nevermore(rateOptions, taskGenerator);

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(events).toMatchObject([
      ["Creating task 0", { pending: 0 }],
      ["Starting task 0", { pending: 1 }],
      ["Creating task 1", { pending: 1 }],
      ["Stopping task 0", { pending: 0 }],
      ["Starting task 1", { pending: 1 }],
      ["Creating task 2", { pending: 1 }],
      ["Stopping task 1", { pending: 0 }],
      ["Starting task 2", { pending: 1 }],
      ["Creating task 3", { pending: 1 }],
      ["Stopping task 2", { pending: 0 }],
      ["Starting task 3", { pending: 1 }],
      ["Stopping task 3", { pending: 0 }],
    ]);

    expect(Math.max(...events.map(([, { pending }]) => pending))).toBe(1);
    expect(duration).toBeGreaterThanOrEqual(
      TASK_COUNT * (rateOptions.intervalMs - 1)
    );
    expect(duration).toBeLessThanOrEqual(
      TASK_COUNT * (rateOptions.intervalMs + 1)
    );
    expect(settlements.length).toBe(TASK_COUNT);
  });

  test("{ intervalMs: 40, intervalSlots: 4 } - 4 tasks execute in parallel", async () => {
    const rateOptions: RateOptions = { intervalMs: 40, intervalSlots: 4 };
    const settlementSequence = nevermore(rateOptions, taskGenerator);

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(events).toMatchObject([
      ["Creating task 0", { pending: 0 }],
      ["Starting task 0", { pending: 1 }],
      ["Creating task 1", { pending: 1 }],
      ["Starting task 1", { pending: 2 }],
      ["Creating task 2", { pending: 2 }],
      ["Starting task 2", { pending: 3 }],
      ["Creating task 3", { pending: 3 }],
      ["Starting task 3", { pending: 4 }],
      ["Stopping task 0", { pending: 3 }],
      ["Stopping task 1", { pending: 2 }],
      ["Stopping task 2", { pending: 1 }],
      ["Stopping task 3", { pending: 0 }],
    ]);

    expect(Math.max(...events.map(([, { pending }]) => pending))).toBe(4);
    expect(duration).toBeGreaterThanOrEqual(TASK_DELAY);
    expect(duration).toBeLessThanOrEqual(TASK_DELAY * 2);
    expect(settlements.length).toBe(TASK_COUNT);
  });

  test("{ intervalMs: 30, intervalSlots: 3 } - 3 tasks run, 4th waits for slot expiry", async () => {
    const rateOptions: RateOptions = { intervalMs: 30, intervalSlots: 3 };
    const settlementSequence = nevermore(rateOptions, taskGenerator);

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(events).toMatchObject([
      ["Creating task 0", { pending: 0 }],
      ["Starting task 0", { pending: 1 }],
      ["Creating task 1", { pending: 1 }],
      ["Starting task 1", { pending: 2 }],
      ["Creating task 2", { pending: 2 }],
      ["Starting task 2", { pending: 3 }],
      ["Creating task 3", { pending: 3 }],
      ["Stopping task 0", { pending: 2 }],
      ["Stopping task 1", { pending: 1 }],
      ["Stopping task 2", { pending: 0 }],
      ["Starting task 3", { pending: 1 }],
      ["Stopping task 3", { pending: 0 }],
    ]);

    expect(Math.max(...events.map(([, { pending }]) => pending))).toBe(3);
    expect(duration).toBeGreaterThanOrEqual(rateOptions.intervalMs * 0.9);
    expect(duration).toBeLessThanOrEqual(rateOptions.intervalMs * 1.5);
    expect(settlements.length).toBe(TASK_COUNT);
  });

  test("Concurrency can override rate", async () => {
    const rateOptions: RateOptions = { intervalMs: 10, intervalSlots: 10 };
    const concurrencyOptions: ConcurrencyOptions = { concurrency: 1 };
    const settlementSequence = nevermore(
      {
        ...rateOptions,
        ...concurrencyOptions,
      },
      taskGenerator
    );

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(Math.max(...events.map(([, { pending }]) => pending))).toBe(1);
    expect(duration).toBeGreaterThanOrEqual(20 * 0.9);
    expect(duration).toBeLessThanOrEqual(20 * 1.5);
    expect(settlements.length).toBe(TASK_COUNT);
  });

  test("Rate can override concurrency", async () => {
    const rateOptions: RateOptions = { intervalMs: 10, intervalSlots: 1 };
    const concurrencyOptions: ConcurrencyOptions = { concurrency: 10 };
    const settlementSequence = nevermore(
      {
        ...rateOptions,
        ...concurrencyOptions,
      },
      taskGenerator
    );

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(Math.max(...events.map(([, { pending }]) => pending))).toBe(1);
    expect(duration).toBeGreaterThanOrEqual(40 * 0.8);
    expect(duration).toBeLessThanOrEqual(40 * 1.5);
    expect(settlements.length).toBe(TASK_COUNT);
  });

  test("1000 tasks { intervalMs: 10, intervalSlots: 100 } - task throughput is adequate", async () => {
    const LARGE_TASK_COUNT = 1000;
    const rateOptions: RateOptions = { intervalMs: 10, intervalSlots: 100 };
    // preallocate jobs
    const job = async () => "foo"; // use just one job
    const jobs = Array.from({ length: LARGE_TASK_COUNT }, () => job);
    const settlementSequence = nevermore(rateOptions, jobs);

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(100 * 0.9);
    expect(duration).toBeLessThanOrEqual(100 * 1.2);
    expect(settlements.length).toBe(LARGE_TASK_COUNT);
  });
});
