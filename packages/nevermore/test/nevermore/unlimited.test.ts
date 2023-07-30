// Allows us to simplify from the pointless
// async () => { await delay(10, "msg") }
// to
// () => delay(10, "msg")
/* eslint-disable @typescript-eslint/promise-function-async */
import { describe, test, expect } from "vitest";
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

  test("Simple delayed message sequence resolves eventually", async () => {
    const settlementSequence = nevermore({
      jobs: function* () {
        for (const msg of ["one", "two", "three"]) {
          yield createMessageJob(msg);
        }
      },
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

  test("Settlements can include a record of failure", async () => {
    const settlementSequence = nevermore({
      jobs: function* () {
        for (const msg of ["one", "two", "three"]) {
          if (msg === "two") {
            yield createFailingMessageJob(msg);
          } else {
            yield createMessageJob(msg);
          }
        }
      },
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

  test("Settlement sequence terminates when cancelPromise resolves", async () => {
    // create awaitable that will resolve after 5 ms before (parallel) jobs resolve
    const awaitable = createAwaitableFlag();
    setTimeout(() => {
      awaitable.flag();
    }, 5);

    const cancelPromise = awaitable.promise;
    function* jobs() {
      for (const msg of ["one", "two", "three"]) {
        yield createMessageJob(msg);
      }
    }

    const settlementSequence = nevermore({ jobs, cancelPromise });

    let settlementCount = 0;
    try {
      for await (const _settlement of settlementSequence) {
        settlementCount++;
      }
    } catch {
      // sequence should have thrown between the first and second settlement
      expect(settlementCount).toBe(0);
      return;
    }
    throw new Error(`Settlement sequence completed even after cancellation`);
  });

  test("Job sequence can be an ordinary iterable", async () => {
    // when job input is a normal iterable
    const settlementSequence = nevermore({
      jobs: [
        createMessageJob("one"),
        createMessageJob("two"),
        createMessageJob("three"),
      ],
    });

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
});
