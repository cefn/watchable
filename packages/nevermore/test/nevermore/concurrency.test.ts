import { describe, test, expect } from "vitest";
import { nevermore } from "../../src";
import { gen2array } from "../testutil";

describe("Nevermore with concurrency", () => {
  test("concurrency<1 throws an error", async () => {
    await expect(async () => {
      await gen2array(nevermore({ concurrency: -1 }, []));
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      '"Concurrency cannot be less than 1 : {\\"concurrency\\":-1}"'
    );
  });

  test("concurrency===1 forces resolution in series", async () => {
    let pending = 0;

    function createIntegerDelayJob(integer: number, delayMs = 10) {
      return Object.assign(
        async () => {
          try {
            pending++;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return { integer, pending };
          } finally {
            pending--;
          }
        },
        {
          integer,
          delayMs,
        }
      );
    }

    // create schedule
    const settlementSequence = nevermore({ concurrency: 1 }, function* () {
      let integer = 0;
      yield createIntegerDelayJob(integer++);
      yield createIntegerDelayJob(integer++);
      yield createIntegerDelayJob(integer++);
    });

    // run schedule
    const startMs = Date.now();
    const settlements = await gen2array(settlementSequence);
    const durationMs = Date.now() - startMs;

    // check 10 ms jobs didn't run in parallel
    expect(settlements).toEqual([
      {
        job: expect.anything(),
        status: "fulfilled",
        value: {
          integer: 0,
          pending: 1,
        },
      },
      {
        job: expect.anything(),
        status: "fulfilled",
        value: {
          integer: 1,
          pending: 1,
        },
      },
      {
        job: expect.anything(),
        status: "fulfilled",
        value: {
          integer: 2,
          pending: 1,
        },
      },
    ]);
    expect(durationMs).toBeGreaterThan(20);
  });
});
