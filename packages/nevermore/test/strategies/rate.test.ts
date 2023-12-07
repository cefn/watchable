import { beforeEach, describe, expect, test } from "vitest";
import {
  createSettlementSequence,
  sleep,
  type RateOptions,
  type ConcurrencyOptions,
} from "../../src";
import { iterable2array } from "../testutil";

describe("Rate limits: ", () => {
  const JOB_DURATION = 5;
  const JOB_COUNT = 4;

  type TaskEvent = [string, { pending: number }];
  let events: TaskEvent[] = [];
  let pending = 0;

  beforeEach(() => {
    events = [];
    pending = 0;
  });

  async function* taskGenerator() {
    for (let taskId = 0; taskId < JOB_COUNT; taskId++) {
      events.push([`Creating task ${taskId}`, { pending }]);
      yield Object.assign(
        async () => {
          const startMs = Date.now();
          events.push([`Starting task ${taskId}`, { pending: ++pending }]);
          await sleep(JOB_DURATION);
          events.push([`Stopping task ${taskId}`, { pending: --pending }]);
          return `Task ${taskId} ${JSON.stringify({
            duration: Date.now() - startMs,
          })}}`;
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

    const settlementSequence = createSettlementSequence(
      rateOptions,
      taskGenerator
    );

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
      JOB_COUNT
    );

    expect(duration).toBeGreaterThanOrEqual(JOB_DURATION - 1);
    expect(duration).toBeLessThan(JOB_DURATION * 2);
    expect(settlements.length).toBe(JOB_COUNT);
  });

  test("{ intervalMs: 10, intervalSlots: 1 } - 4 tasks run in series", async () => {
    const rateOptions: RateOptions = { intervalMs: 10, intervalSlots: 1 };
    const settlementSequence = createSettlementSequence(
      rateOptions,
      taskGenerator
    );

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
      (JOB_COUNT - 1) * (rateOptions.intervalMs - 1) // task completes fractionally into Nth interval
    );
    expect(duration).toBeLessThanOrEqual(
      (JOB_COUNT + 1) * (rateOptions.intervalMs + 1)
    );
    expect(settlements.length).toBe(JOB_COUNT);
  });

  test("{ intervalMs: 40, intervalSlots: 4 } - 4 tasks execute in parallel", async () => {
    const rateOptions: RateOptions = { intervalMs: 40, intervalSlots: 4 };
    const settlementSequence = createSettlementSequence(
      rateOptions,
      taskGenerator
    );

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
    expect(duration).toBeGreaterThanOrEqual(JOB_DURATION);
    expect(duration).toBeLessThanOrEqual(JOB_DURATION * 2);
    expect(settlements.length).toBe(JOB_COUNT);
  });

  test("{ intervalMs: 30, intervalSlots: 3 } - 3 tasks run, 4th waits for slot expiry", async () => {
    const rateOptions: RateOptions = { intervalMs: 30, intervalSlots: 3 };
    const settlementSequence = createSettlementSequence(
      rateOptions,
      taskGenerator
    );

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
    expect(settlements.length).toBe(JOB_COUNT);
  });

  test("Concurrency can override rate", async () => {
    // this rate limit would allow all 4 tasks to complete immediately
    const rateOptions: RateOptions = { intervalMs: 10, intervalSlots: 10 };
    // this concurrency should prevent more than one executing at once
    // tasks should be in series and take JOB_DURATION
    const concurrencyOptions: ConcurrencyOptions = { concurrency: 1 };
    const settlementSequence = createSettlementSequence(
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
    expect(duration).toBeGreaterThanOrEqual(JOB_COUNT * JOB_DURATION);
    expect(duration).toBeLessThanOrEqual(JOB_COUNT * JOB_DURATION * 1.5);
    expect(settlements.length).toBe(JOB_COUNT);
  });

  test("Rate can override concurrency", async () => {
    const rateOptions: RateOptions = { intervalMs: 10, intervalSlots: 1 };
    const concurrencyOptions: ConcurrencyOptions = { concurrency: 10 };
    const settlementSequence = createSettlementSequence(
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
    expect(settlements.length).toBe(JOB_COUNT);
  });

  test("Large task count - task throughput is adequate", async () => {
    const LARGE_JOB_COUNT = 1001; // off-by-one task forces a 'final' period at around 1000ms
    const rateOptions: RateOptions = { intervalMs: 100, intervalSlots: 100 };
    // preallocate jobs
    // for speed create an jobIterator
    // which always returns the same job
    const job = async () => "foo";
    let jobCount = 0;
    const jobIterable = {
      [Symbol.iterator]: () => jobIterable,
      next: () => {
        if (jobCount < LARGE_JOB_COUNT) {
          jobCount++;
          return { done: false, value: job };
        }
        return { done: true, value: undefined };
      },
    } satisfies Iterable<typeof job> & Iterator<typeof job>;

    const settlementSequence = createSettlementSequence(
      rateOptions,
      jobIterable
    );

    const start = Date.now();
    let settlementCount = 0;
    for await (const _settlement of settlementSequence) {
      settlementCount++;
    }
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(LARGE_JOB_COUNT);
    expect(duration).toBeLessThanOrEqual(LARGE_JOB_COUNT * 1.1);

    expect(settlementCount).toBe(LARGE_JOB_COUNT);
  });
});
