/* eslint-disable @typescript-eslint/promise-function-async */

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

export async function gen2array<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of gen) {
    out.push(x);
  }
  return out;
}
