import { describe, expect, test } from "vitest";
import { type NevermoreOptions, sleep, nevermore, namedRace } from "../src";
import { iterable2array } from "./testutil";

function createRandomOptions(): NevermoreOptions {
  const options: NevermoreOptions = {};
  if (Math.random() < 0.25) {
    options.concurrency = 1 + Math.floor(Math.random() * 10);
  }
  if (Math.random() < 0.25) {
    options.intervalMs = 1 + Math.floor(Math.random() * 10);
    if (Math.random() < 0.5) {
      options.intervalSlots = 1 + Math.floor(Math.random() * 10);
    }
  }
  if (Math.random() < 0.25) {
    options.retries = 1 + Math.floor(Math.random() * 10);
  }
  if (Math.random() < 0.25) {
    options.timeoutMs = 1 + Math.floor(Math.random() * 10);
  }
  return options;
}

function createRandomJob() {
  const delayMs = 0 + Math.floor(Math.random() * 20);
  const failureProbability = Math.random() * 0.5;
  const job = Object.assign(
    async () => {
      if (delayMs > 0) {
        await sleep(delayMs);
      }
      if (Math.random() < failureProbability) {
        throw new Error("Failed");
      }
      return "Succeeded";
    },
    { config: { delayMs, failureProbability } }
  );
  return job;
}

describe("Fuzz testing", () => {
  test("Create random combinations of options, tasks. Always expect eventual settlement", async () => {
    for (let testId = 0; testId < 64; testId++) {
      const length = 1 + Math.floor(Math.random() * 9);
      const randomJobs = Array.from({ length }, createRandomJob);
      const randomOptions = createRandomOptions();

      const randomJobConfigs = randomJobs.map(({ config }) => config);

      const settlementSequence = nevermore(randomOptions, randomJobs);
      const settlementsPromise = iterable2array(settlementSequence);
      const impatientPromise = sleep(3000);
      const winner = await namedRace({ settlementsPromise, impatientPromise });
      if (winner === "impatientPromise") {
        console.log(
          `${JSON.stringify({
            randomOptions,
            randomJobConfigs,
          })}`
        );
        throw new Error("Fuzz test took too long");
      }
      const settlements = await settlementsPromise;
      expect(settlements.length).toBe(length);
    }
  });
});
