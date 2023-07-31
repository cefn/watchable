// Allows us to simplify from the pointless
// async () => { await delay(10, "msg") }
// to
// () => delay(10, "msg")
/* eslint-disable @typescript-eslint/promise-function-async */
import { describe, test, expect, vi } from "vitest";
import { nevermore } from "../../src/";
import { createAwaitableFlag } from "../../src/util";

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
    const settlementSequence = nevermore(
      {
        concurrency: Number.MAX_SAFE_INTEGER,
      },
      function* () {
        for (const msg of ["one", "two", "three"]) {
          yield createMessageJob(msg);
        }
      }
    );

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

  test("Job sequence can be async generator", async () => {
    // when job input is a normal iterable
    const settlementSequence = nevermore(
      {
        concurrency: Number.MAX_SAFE_INTEGER,
      },
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
  });

  test("Job sequence can be an ordinary iterable", async () => {
    // when job input is a normal iterable
    const settlementSequence = nevermore(
      {
        concurrency: Number.MAX_SAFE_INTEGER,
      },
      [
        createMessageJob("one"),
        createMessageJob("two"),
        createMessageJob("three"),
      ]
    );

    // results in settlements as normal
    expect(await gen2array(settlementSequence)).toMatchObject([
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
  });

  test("Settlements allow Generic job with caller-provided metadata", async () => {
    const settlementSequence = nevermore(
      {
        concurrency: Number.MAX_SAFE_INTEGER,
      },
      function* () {
        for (const msg of ["one", "two", "three"]) {
          yield createMessageJob(msg);
        }
      }
    );

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
    const settlementSequence = nevermore(
      {
        concurrency: Number.MAX_SAFE_INTEGER,
      },
      function* () {
        for (const msg of ["one", "two", "three"]) {
          if (msg === "two") {
            yield createFailingMessageJob(msg);
          } else {
            yield createMessageJob(msg);
          }
        }
      }
    );

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
        kind: "rejected",
        error: new Error(`Emulated message failure`),
      },
      {
        job: expect.any(Function),
        kind: "resolved",
        value: "three",
      },
    ]);
  });

  test("Can cancel before first job launch", async () => {
    // create awaitable that will resolve after 5 ms before (parallel) jobs resolve
    const awaitable = createAwaitableFlag();
    setTimeout(() => {
      awaitable.flag();
    }, 5);

    const jobYielded = vi.fn();
    const imaginaryJob = vi.fn();

    const settlementSequence = nevermore(
      {
        cancelPromise: awaitable.promise,
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
    const awaitable = createAwaitableFlag();
    setTimeout(() => {
      awaitable.flag();
    }, 5);

    const settlementSequence = nevermore(
      {
        cancelPromise: awaitable.promise,
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
