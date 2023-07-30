// Allows us to simplify from the pointless
// async () => { await delay(10, "msg") }
// to
// () => delay(10, "msg")
/* eslint-disable @typescript-eslint/promise-function-async */
import { describe, test, expect } from "vitest";
import { nevermore } from "../../src/";

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise<T>((resolve) => {
    setTimeout(
      (value) => {
        resolve(value);
      },
      ms,
      value
    );
  });
}

export async function gen2array<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of gen) {
    out.push(x);
  }
  return out;
}

describe("Nevermore pipelines without limits", () => {
  describe("All sequence types", () => {
    // create a job function with associated config metadata
    function createMessageJob(message: string) {
      const factory = () => delay(10, message);
      const config = { message };
      return Object.assign(factory, { config });
    }

    function* createMessageJobSequence() {
      for (const msg of ["one", "two", "three"]) {
        yield createMessageJob(msg);
      }
    }

    test("Array sequence resolves eventually", async () => {
      const settlementSequence = nevermore({
        jobs: createMessageJobSequence,
      });

      // flatten async iterator to an eventual array of settlements
      const settlements = await gen2array(settlementSequence);

      // settlements include jobs and outcomes
      expect(settlements).toMatchObject([
        {
          job: expect.any(Function),
          kind: "resolved",
          value: "one",
        },
        {
          job: expect.any(Function),
          kind: "resolved",
          value: "two",
        },
        {
          job: expect.any(Function),
          kind: "resolved",
          value: "three",
        },
      ]);

      // settlements' jobs reference their own config
      expect(settlements.map(({ job: { config } }) => config)).toMatchObject([
        { message: "one" },
        { message: "two" },
        { message: "three" },
      ]);
    });
  });
});
