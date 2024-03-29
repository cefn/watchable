import { type Immutable, createStore } from "@watchable/store";
import { withSelectorQueue } from "@watchable/store-follow";

import { manyTicks } from "./util";

import { describe, test, expect } from "vitest";

interface Location {
  name: string;
  distance: number;
}

type CounterState = Immutable<{
  near: Location;
  far: Location;
}>;

const INITIAL_STATE: CounterState = {
  near: { name: "London", distance: 100 },
  far: { name: "Sydney", distance: 10000 },
} as const;

const manchester = {
  name: "Manchester",
  distance: 100,
};
const birmingham = {
  name: "Birmingham",
  distance: 100,
};

describe("withSelectorQueue behaviour", () => {
  test("withSelectorQueue passes a queue notifying selected changes", async () => {
    const store = createStore(INITIAL_STATE);

    const notified: Location[] = [];

    void withSelectorQueue(
      store,
      (state) => state.near,
      async (queue, initialValue) => {
        let near = initialValue;
        for (;;) {
          notified.push(near);
          near = await queue.receive();
        }
      }
    );
    store.write({
      ...store.read(),
      near: birmingham,
    });
    store.write({
      ...store.read(),
      near: manchester,
    });

    await manyTicks();
    expect(notified.length).toBe(3);
    expect(notified[0]).toBe(INITIAL_STATE.near);
    expect(notified[1]).toBe(birmingham);
    expect(notified[2]).toBe(manchester);
  });

  test("withSelectorQueue doesn't receive again when selected is identical", async () => {
    const store = createStore(INITIAL_STATE);

    const notified: Location[] = [];

    void withSelectorQueue(
      store,
      (state) => state.near,
      async (queue, initialValue) => {
        let near = initialValue;
        for (;;) {
          notified.push(near);
          near = await queue.receive();
        }
      }
    );

    const { near } = INITIAL_STATE;
    store.write({
      ...store.read(),
      near,
    });

    await manyTicks();
    expect(notified.length).toBe(1);
    expect(notified[0]).toBe(INITIAL_STATE.near);
  });

  test("withSelectorQueue queueHandler can return a value", async () => {
    const store = createStore(INITIAL_STATE);

    const notified: Location[] = [];

    const promiseEnding = withSelectorQueue(
      store,
      (state) => state.near,
      async (queue, initialValue) => {
        let near = initialValue;
        for (;;) {
          notified.push(near);
          near = await queue.receive();
          if (near === manchester) {
            return manchester;
          }
        }
      }
    );

    store.write({
      ...store.read(),
      near: birmingham,
    });
    store.write({
      ...store.read(),
      near: manchester,
    });

    await manyTicks();
    expect(notified.length).toBe(2);
    expect(notified[0]).toBe(INITIAL_STATE.near);
    expect(notified[1]).toBe(birmingham);

    const ending = await promiseEnding;
    expect(ending).toBe(manchester);
  });
});
