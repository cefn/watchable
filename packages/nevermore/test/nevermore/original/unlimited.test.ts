/* eslint-disable @typescript-eslint/promise-function-async */
import { describe, test, expect, vi } from "vitest";
import { nevermore } from "../../src/";
import type { NevermoreOptions } from "../../src/types";
import { delay, gen2array } from "../testutil";
import { createNotifiable } from "../../src/util";

const INFINITE_CONCURRENCY: NevermoreOptions = {
  concurrency: Number.MAX_SAFE_INTEGER,
};

describe("Nevermore pipelines without limits", () => {
  // create a successful job function with associated config metadata
  function createMessageJob(message: string, delayMs = 10) {
    const factory = () => delay(delayMs, message);
    const config = { message };
    return Object.assign(factory, { config });
  }

  // create a failing job function with associated config metadata
  function createFailingMessageJob(message: string) {
    const successFactory = createMessageJob(message);
    const failureFactory = () =>
      successFactory().then(() => {
        throw new Error(`Emulated message failure`);
      });
    const config = { message };
    return Object.assign(failureFactory, { config });
  }

  test("Job sequence can be generator", async () => {
    const settlementSequence = nevermore(INFINITE_CONCURRENCY, function* () {
      for (const msg of ["one", "two", "three"]) {
        yield createMessageJob(msg);
      }
    });

    // flatten async iterator to an eventual array of settlements
    const settlements = await gen2array(settlementSequence);

    // settlements include jobs and outcomes
    expect(settlements).toMatchObject([
      {
        job: expect.anything(),
        status: "fulfilled",
        value: "one",
      },
      {
        job: expect.anything(),
        status: "fulfilled",
        value: "two",
      },
      {
        job: expect.anything(),
        status: "fulfilled",
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

  test("Job sequence can be async generator", async () => {
    // when job input is a normal iterable
    const settlementSequence = nevermore(
      INFINITE_CONCURRENCY,
      async function* () {
        for (const msg of ["one", "two", "three"]) {
          await delay(10, undefined);
          yield createMessageJob(msg);
        }
      }
    );

    // results in settlements as normal
    expect(await gen2array(settlementSequence)).toMatchObject([
      {
        job: expect.anything(),
        status: "fulfilled",
        value: "one",
      },
      {
        job: expect.anything(),
        status: "fulfilled",
        value: "two",
      },
      {
        job: expect.anything(),
        status: "fulfilled",
        value: "three",
      },
    ]);
  });

  test("Job sequence can be an ordinary iterable", async () => {
    // when job input is a normal iterable
    const settlementSequence = nevermore(INFINITE_CONCURRENCY, [
      createMessageJob("one"),
      createMessageJob("two"),
      createMessageJob("three"),
    ]);

    // results in settlements as normal
    expect(await gen2array(settlementSequence)).toMatchObject([
      {
        job: expect.anything(),
        status: "fulfilled",
        value: "one",
      },
      {
        job: expect.anything(),
        status: "fulfilled",
        value: "two",
      },
      {
        job: expect.anything(),
        status: "fulfilled",
        value: "three",
      },
    ]);
  });

  test("Settlements allow Generic job with caller-provided metadata", async () => {
    const settlementSequence = nevermore(INFINITE_CONCURRENCY, function* () {
      for (const msg of ["one", "two", "three"]) {
        yield createMessageJob(msg);
      }
    });

    // flatten async iterator to an eventual array of settlements
    const settlements = await gen2array(settlementSequence);

    // settlements' jobs reference their own config
    expect(settlements.map(({ job: { config } }) => config)).toMatchObject([
      { message: "one" },
      { message: "two" },
      { message: "three" },
    ]);
  });

  test("Settlements can include a record of failure", async () => {
    const settlementSequence = nevermore(INFINITE_CONCURRENCY, function* () {
      for (const msg of ["one", "two", "three"]) {
        if (msg === "two") {
          yield createFailingMessageJob(msg);
        } else {
          yield createMessageJob(msg);
        }
      }
    });

    // flatten async iterator to an eventual array of settlements
    const settlements = await gen2array(settlementSequence);

    // settlements include jobs and outcomes
    expect(settlements).toMatchObject([
      {
        job: expect.anything(),
        status: "fulfilled",
        value: "one",
      },
      {
        job: expect.anything(),
        status: "rejected",
        reason: new Error(`Emulated message failure`),
      },
      {
        job: expect.anything(),
        status: "fulfilled",
        value: "three",
      },
    ]);
  });

  test("Can cancel before first job launch", async () => {
    // create awaitable that will resolve after 5 ms before (parallel) jobs resolve
    const notifiable = createNotifiable();
    setTimeout(() => {
      notifiable.notify();
    }, 5);

    const jobYielded = vi.fn();
    const imaginaryJob = vi.fn();

    const settlementSequence = nevermore(
      {
        cancelPromise: notifiable.promise,
      },
      async function* jobs() {
        await delay(50, undefined);
        jobYielded();
        yield imaginaryJob;
      }
    );

    let settlementCount = 0;
    try {
      for await (const _settlement of settlementSequence) {
        settlementCount++;
      }
    } catch {
      // first job was not yet yielded
      expect(jobYielded).not.toBeCalled();
      // first job was not yet invoked
      expect(imaginaryJob).not.toBeCalled();
      // first job was not yet settled
      expect(settlementCount).toBe(0);
      return;
    }
    throw new Error(`Settlement sequence completed even after cancellation`);
  });

  test("Settlement sequence terminates if cancelPromise resolves before job promises resolve", async () => {
    // create awaitable that will resolve after 5 ms before (parallel) jobs resolve
    const notifiable = createNotifiable();
    setTimeout(() => {
      notifiable.notify();
    }, 5);

    const settlementSequence = nevermore(
      {
        cancelPromise: notifiable.promise,
      },
      function* () {
        for (const msg of ["one", "two", "three"]) {
          yield createMessageJob(msg);
        }
      }
    );

    let settlementCount = 0;
    try {
      for await (const _settlement of settlementSequence) {
        settlementCount++;
      }
    } catch {
      // sequence should have thrown before first settlement
      expect(settlementCount).toBe(0);
      return;
    }
    throw new Error(`Settlement sequence completed even after cancellation`);
  });
});
