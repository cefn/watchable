// Allows us to simplify from the pointless
// async () => { await delay(10, "msg") }
// to
// () => delay(10, "msg")
/* eslint-disable @typescript-eslint/promise-function-async */
import { describe, test, expect } from "vitest";
import { nevermore } from "../../src/";

async function delay<T>(ms: number, value: T): Promise<T> {
  return await new Promise<T>((resolve) => setTimeout(resolve, ms, value));
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
    test("Array sequence resolves eventually", async () => {
      const sequence = nevermore({
        jobs: function* () {
          for (const msg of ["one", "two", "three"]) {
            yield Object.assign(() => delay(10, "msg"), { msg });
          }
        },
      });

      expect(await gen2array(sequence)).toMatchInlineSnapshot();
    });
  });
});
