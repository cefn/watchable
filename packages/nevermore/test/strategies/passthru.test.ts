/** Proves the reference behaviour of createPassthruPipe. This should be
 * transparent and affect nothing about job behaviours, even though it intercepts
 * all launches and settlements. This ensures it's a good starting reference for
 * any new strategy. */

import { describe, test, expect } from "vitest";

import { nevermore, createPassthruPipe, serializeError } from "../../src/";

describe("Passthru strategy has no effect", () => {
  test("Simple job sequence", async () => {
    const settlementSequence = nevermore(
      { concurrency: Number.MAX_SAFE_INTEGER, pipes: [createPassthruPipe()] },
      function* () {
        yield Object.assign(async () => "foo", { task: 0 });
        yield Object.assign(async () => "bar", { task: 1 });
        yield Object.assign(async () => "baz", { task: 2 });
      }
    );

    // log eventual settlements to an array
    const logs: string[] = [];

    for await (const settlement of settlementSequence) {
      const { status, job } = settlement;
      if (status === "fulfilled") {
        logs.push(`Task ${job.task} succeeded. Value is ${settlement.value}`);
        continue;
      }
      logs.push(
        `Task ${job.task} Failed. Reason is ${serializeError(
          settlement.reason
        )}`
      );
    }

    expect(logs).toMatchInlineSnapshot(`
      [
        "Task 0 succeeded. Value is foo",
        "Task 1 succeeded. Value is bar",
        "Task 2 succeeded. Value is baz",
      ]
    `);
  });
});
