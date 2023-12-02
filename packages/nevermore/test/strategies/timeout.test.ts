import { describe, expect, test } from "vitest";
import { nevermore, sleep } from "../../src";
import { iterable2array } from "../testutil";

describe("Timeout behaviour", () => {
  test("Fails tasks which take too long", async () => {
    const settlementSequence = nevermore({ timeoutMs: 5 }, function* () {
      yield Object.assign(async () => await sleep(1), { taskId: 0 });
      yield Object.assign(async () => await sleep(10), { taskId: 1 });
      yield Object.assign(async () => await sleep(1), { taskId: 2 });
    });

    const settlements = await iterable2array(settlementSequence);
    const settlementStatuses = settlements.map(
      ({ status, job: { taskId } }) => `task ${taskId} status: ${status}`
    );
    expect(settlementStatuses).toMatchInlineSnapshot(`
      [
        "task 0 status: fulfilled",
        "task 2 status: fulfilled",
        "task 1 status: rejected",
      ]
    `);
  });
});
