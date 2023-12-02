/* eslint-disable @typescript-eslint/promise-function-async */

import { sleep } from "../src";

export function delay<T>(ms: number, value: T): Promise<T> {
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

export async function iterable2array<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of gen) {
    out.push(x);
  }
  return out;
}

export function createFailingJob(options: {
  failures: number;
  delayMs?: number;
}) {
  const { failures, delayMs = 1 } = options;
  let failureCount = 0;
  return async () => {
    await sleep(delayMs);
    if (failureCount < failures) {
      failureCount++;
      throw new Error("Failed");
    }
    return "Succeeded";
  };
}
