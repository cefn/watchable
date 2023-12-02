import { beforeEach, describe, expect, test } from "vitest";
import { iterable2array } from "../testutil";

import { nevermore, sleep } from "../../src";

type JobEvent = [string, { pending: number }];

describe("Concurrency limits:", () => {
  const JOB_DELAY = 10;
  const JOB_COUNT = 4;

  let events: JobEvent[] = [];
  let pending = 0;

  beforeEach(() => {
    events = [];
    pending = 0;
  });

  async function* taskGenerator() {
    for (let taskId = 0; taskId < JOB_COUNT; taskId++) {
      events.push([`Creating #${taskId}`, { pending }]);
      yield Object.assign(
        async () => {
          const startMs = Date.now();
          events.push([`Starting #${taskId}`, { pending: ++pending }]);
          await sleep(JOB_DELAY);
          events.push([`Stopping #${taskId}`, { pending: --pending }]);
          return `Duration: ${Date.now() - startMs}`;
        },
        { taskId }
      );
    }
  }

  test("with no concurrency limit, tasks run in parallel", async () => {
    const settlementSequence = nevermore({}, taskGenerator);

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(Math.max(...events.map(([, { pending }]) => pending))).toBe(
      JOB_COUNT
    );
    expect(duration).toBeGreaterThanOrEqual(JOB_DELAY);
    expect(duration).toBeLessThan(JOB_DELAY * 2);
    expect(settlements.length).toBe(JOB_COUNT);

    expect(events).toMatchInlineSnapshot([
      ["Creating #0", { pending: 0 }],
      ["Starting #0", { pending: 1 }],
      ["Creating #1", { pending: 1 }],
      ["Starting #1", { pending: 2 }],
      ["Creating #2", { pending: 2 }],
      ["Starting #2", { pending: 3 }],
      ["Creating #3", { pending: 3 }],
      ["Starting #3", { pending: 4 }],
      ["Stopping #0", { pending: 3 }],
      ["Stopping #1", { pending: 2 }],
      ["Stopping #2", { pending: 1 }],
      ["Stopping #3", { pending: 0 }],
    ]);
  });

  test("with infinite concurrency limit, tasks run in parallel", async () => {
    const settlementSequence = nevermore(
      { concurrency: Number.MAX_SAFE_INTEGER },
      taskGenerator
    );

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(Math.max(...events.map(([, { pending }]) => pending))).toBe(
      JOB_COUNT
    );
    expect(duration).toBeGreaterThanOrEqual(JOB_DELAY);
    expect(duration).toBeLessThan(JOB_DELAY * 2);
    expect(settlements.length).toBe(JOB_COUNT);

    expect(events).toMatchInlineSnapshot([
      ["Creating #0", { pending: 0 }],
      ["Starting #0", { pending: 1 }],
      ["Creating #1", { pending: 1 }],
      ["Starting #1", { pending: 2 }],
      ["Creating #2", { pending: 2 }],
      ["Starting #2", { pending: 3 }],
      ["Creating #3", { pending: 3 }],
      ["Starting #3", { pending: 4 }],
      ["Stopping #0", { pending: 3 }],
      ["Stopping #1", { pending: 2 }],
      ["Stopping #2", { pending: 1 }],
      ["Stopping #3", { pending: 0 }],
    ]);
  });

  test("with concurrency 1, tasks run in series", async () => {
    const settlementSequence = nevermore({ concurrency: 1 }, taskGenerator);

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(Math.max(...events.map(([, { pending }]) => pending))).toBe(1);
    expect(duration).toBeGreaterThanOrEqual(JOB_COUNT * JOB_DELAY);
    expect(settlements.length).toBe(JOB_COUNT);

    expect(events).toMatchInlineSnapshot([
      ["Creating #0", { pending: 0 }],
      ["Starting #0", { pending: 1 }],
      ["Creating #1", { pending: 1 }],
      ["Stopping #0", { pending: 0 }],
      ["Starting #1", { pending: 1 }],
      ["Creating #2", { pending: 1 }],
      ["Stopping #1", { pending: 0 }],
      ["Starting #2", { pending: 1 }],
      ["Creating #3", { pending: 1 }],
      ["Stopping #2", { pending: 0 }],
      ["Starting #3", { pending: 1 }],
      ["Stopping #3", { pending: 0 }],
    ]);
  });

  test("concurrency limits the number of parallel tasks", async () => {
    const settlementSequence = nevermore({ concurrency: 2 }, taskGenerator);

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(Math.max(...events.map(([, { pending }]) => pending))).toBe(2);
    expect(duration).toBeGreaterThanOrEqual(JOB_DELAY * 2);
    expect(duration).toBeLessThan(JOB_DELAY * 4);
    expect(settlements.length).toBe(JOB_COUNT);
  });

  test("sequence of task settlements as expected", async () => {
    const settlementSequence = nevermore({ concurrency: 2 }, taskGenerator);

    for await (const settlement of settlementSequence) {
      const { job, status } = settlement;
      if (status === "rejected") {
        throw new Error("Test: unexpected rejection");
      }
      events.push([`Settled  #${job.taskId}`, { pending }]);
    }

    // check
    expect(events).toMatchObject([
      ["Creating #0", { pending: 0 }],
      ["Starting #0", { pending: 1 }],
      ["Creating #1", { pending: 1 }],
      ["Starting #1", { pending: 2 }],
      ["Creating #2", { pending: 2 }],
      ["Stopping #0", { pending: 1 }],
      ["Starting #2", { pending: 2 }],
      ["Settled  #0", { pending: 2 }],
      ["Creating #3", { pending: 2 }],
      ["Stopping #1", { pending: 1 }],
      ["Starting #3", { pending: 2 }],
      ["Settled  #1", { pending: 2 }],
      ["Stopping #2", { pending: 1 }],
      ["Settled  #2", { pending: 1 }],
      ["Stopping #3", { pending: 0 }],
      ["Settled  #3", { pending: 0 }],
    ]);
  });
});
