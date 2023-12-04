/* eslint-disable @typescript-eslint/promise-function-async */
import { describe, test, expect, vi } from "vitest";
import {
  createConcurrencyPipe,
  createRetryPipe,
  nevermore,
  type NevermoreOptions,
} from "../src";
import { createFailingJob, delay, iterable2array } from "./testutil";
import { createFlag } from "../src/util";

const NOOP_OPTIONS: NevermoreOptions = {};

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
    const settlementSequence = nevermore(NOOP_OPTIONS, function* () {
      for (const msg of ["one", "two", "three"]) {
        yield createMessageJob(msg);
      }
    });

    // flatten async iterator to an eventual array of settlements
    const settlements = await iterable2array(settlementSequence);

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
    const settlementSequence = nevermore(NOOP_OPTIONS, async function* () {
      for (const msg of ["one", "two", "three"]) {
        await delay(10, undefined);
        yield createMessageJob(msg);
      }
    });

    // results in settlements as normal
    expect(await iterable2array(settlementSequence)).toMatchObject([
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
    const settlementSequence = nevermore(NOOP_OPTIONS, [
      createMessageJob("one"),
      createMessageJob("two"),
      createMessageJob("three"),
    ]);

    // results in settlements as normal
    expect(await iterable2array(settlementSequence)).toMatchObject([
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

  test("Job sequence can be empty array", async () => {
    const settlementSequence = nevermore(NOOP_OPTIONS, []);
    const settlements = await iterable2array(settlementSequence);
    expect(settlements.length).toBe(0);
  });

  test("Settlements allow Generic job with caller-provided metadata", async () => {
    const settlementSequence = nevermore(NOOP_OPTIONS, function* () {
      for (const msg of ["one", "two", "three"]) {
        yield createMessageJob(msg);
      }
    });

    // flatten async iterator to an eventual array of settlements
    const settlements = await iterable2array(settlementSequence);

    // settlements' jobs reference their own config
    expect(settlements.map(({ job: { config } }) => config)).toMatchObject([
      { message: "one" },
      { message: "two" },
      { message: "three" },
    ]);
  });

  test("Settlements can include a record of failure", async () => {
    const settlementSequence = nevermore(NOOP_OPTIONS, function* () {
      for (const msg of ["one", "two", "three"]) {
        if (msg === "two") {
          yield createFailingMessageJob(msg);
        } else {
          yield createMessageJob(msg);
        }
      }
    });

    // flatten async iterator to an eventual array of settlements
    const settlements = await iterable2array(settlementSequence);

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

  test("Can feed jobs through retry to concurrency", async () => {
    const options: NevermoreOptions = {
      pipes: [
        createConcurrencyPipe({ concurrency: 1 }),
        createRetryPipe({ retries: 1 }),
      ],
    };

    const settlementSequence = nevermore(options, function* () {
      yield createFailingJob({ failures: 1, delayMs: 10 });
      yield createFailingJob({ failures: 1, delayMs: 10 });
      yield createFailingJob({ failures: 1, delayMs: 10 });
    });

    const settlements = await iterable2array(settlementSequence);
    expect(settlements.length).toBe(3);
  });

  test("Can feed jobs through retry if concurrency one more than failing jobs", async () => {
    const options: NevermoreOptions = {
      pipes: [
        createConcurrencyPipe({ concurrency: 4 }),
        createRetryPipe({ retries: 1 }),
      ],
    };

    const settlementSequence = nevermore(options, function* () {
      yield createFailingJob({ failures: 1, delayMs: 10 });
      yield createFailingJob({ failures: 1, delayMs: 10 });
      yield createFailingJob({ failures: 1, delayMs: 10 });
    });

    const settlements = await iterable2array(settlementSequence);
    expect(settlements.length).toBe(3);
  });

  test("Can feed jobs through concurrency to retry", async () => {
    const options: NevermoreOptions = {
      pipes: [
        createRetryPipe({ retries: 1 }),
        createConcurrencyPipe({ concurrency: 1 }),
      ],
    };

    const settlementSequence = nevermore(options, function* () {
      yield createFailingJob({ failures: 1, delayMs: 10 });
      yield createFailingJob({ failures: 1, delayMs: 10 });
      yield createFailingJob({ failures: 1, delayMs: 10 });
    });

    const settlements = await iterable2array(settlementSequence);
    expect(settlements.length).toBe(3);
  });

  test.skip("Can cancel before first job launch", async () => {
    // create awaitable that will resolve after 5 ms before (parallel) jobs resolve
    const notifiable = createFlag();
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

  test.skip("Settlement sequence terminates if cancelPromise resolves before job promises resolve", async () => {
    // create awaitable that will resolve after 5 ms before (parallel) jobs resolve
    const notifiable = createFlag();
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
