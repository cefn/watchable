import { beforeEach, describe, expect, test } from "vitest";
import { iterable2array } from "../../testutil";

import { nevermore, sleep } from "../../../src";

describe("Concurrency", () => {
  const TASK_DELAY = 10;
  const TASK_COUNT = 4;

  type TaskEvent = [string, { pending: number }];
  let logs: TaskEvent[] = [];
  let pending = 0;

  beforeEach(() => {
    logs = [];
    pending = 0;
  });

  async function* taskGenerator() {
    for (let taskId = 0; taskId < TASK_COUNT; taskId++) {
      logs.push([`Creating task ${taskId}`, { pending }]);
      yield Object.assign(
        async () => {
          const startMs = Date.now();
          logs.push([`Starting task ${taskId}`, { pending: ++pending }]);
          await sleep(TASK_DELAY);
          logs.push([`Stopping task ${taskId}`, { pending: --pending }]);
          return `Duration: ${Date.now() - startMs}`;
        },
        { taskId }
      );
    }
  }

  test("with no concurrency limit, tasks run in parallel", async () => {
    const settlementSequence = nevermore({}, taskGenerator);
    await iterable2array(settlementSequence);
    expect(Math.max(...logs.map(([, { pending }]) => pending))).toBe(4);
  });

  test("with infinite concurrency limit, tasks run in parallel", async () => {
    const settlementSequence = nevermore(
      { concurrency: Number.MAX_SAFE_INTEGER },
      taskGenerator
    );

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(Math.max(...logs.map(([, { pending }]) => pending))).toBe(4);
    expect(duration).toBeGreaterThanOrEqual(TASK_DELAY);
    expect(duration).toBeLessThan(TASK_DELAY * 1.5);
    expect(settlements.length).toBe(TASK_COUNT);
  });

  test("with concurrency 1, tasks run in series", async () => {
    const settlementSequence = nevermore({ concurrency: 1 }, taskGenerator);

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(Math.max(...logs.map(([, { pending }]) => pending))).toBe(1);
    expect(duration).toBeGreaterThanOrEqual(TASK_COUNT * TASK_DELAY);
    expect(settlements.length).toBe(TASK_COUNT);
  });

  test("concurrency limits the number of parallel tasks", async () => {
    const settlementSequence = nevermore({ concurrency: 2 }, taskGenerator);

    const start = Date.now();
    const settlements = await iterable2array(settlementSequence);
    const duration = Date.now() - start;

    expect(Math.max(...logs.map(([, { pending }]) => pending))).toBe(2);
    expect(duration).toBeGreaterThanOrEqual(TASK_DELAY * 2);
    expect(duration).toBeLessThan(TASK_DELAY * 3);
    expect(settlements.length).toBe(TASK_COUNT);
  });

  test("sequence of task events as expected", async () => {
    const settlementSequence = nevermore({ concurrency: 2 }, taskGenerator);

    for await (const settlement of settlementSequence) {
      const { job, status } = settlement;
      if (status === "rejected") {
        throw new Error("Test: unexpected rejection");
      }
      logs.push([`Settled task ${job.taskId}`, { pending: pending }]);
    }

    // check
    expect(logs).toMatchObject([
      ["Creating task 0", { pending: 0 }],
      ["Starting task 0", { pending: 1 }],
      ["Creating task 1", { pending: 1 }],
      ["Starting task 1", { pending: 2 }],
      ["Stopping task 0", { pending: 1 }],
      ["Creating task 2", { pending: 1 }],
      ["Starting task 2", { pending: 2 }],
      ["Settled task 0", { pending: 2 }],
      ["Stopping task 1", { pending: 1 }],
      ["Creating task 3", { pending: 1 }],
      ["Starting task 3", { pending: 2 }],
      ["Settled task 1", { pending: 2 }],
      ["Stopping task 2", { pending: 1 }],
      ["Settled task 2", { pending: 1 }],
      ["Stopping task 3", { pending: 0 }],
      ["Settled task 3", { pending: 0 }],
    ]);
  });
});
