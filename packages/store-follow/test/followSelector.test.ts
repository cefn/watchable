import { createStore, Immutable, Store } from "@lauf/store";
import { followSelector } from "@lauf/store-follow";

import { manyTicks } from "./util";

interface Location {
  name: string;
  distance: number;
}

interface AppState {
  near: Location;
  far: Location;
}

const INITIAL_STATE: Immutable<AppState> = {
  near: { name: "London", distance: 100 },
  far: { name: "Sydney", distance: 10000 },
};

const timbuktu = {
  name: "Timbuktu",
  distance: 2000,
};
const beijing = {
  name: "Beijing",
  distance: 4000,
};
const manchester = {
  name: "Manchester",
  distance: 100,
};
const birmingham = {
  name: "Birmingham",
  distance: 100,
};

describe("followSelector behaviour", () => {
  test("follower called with initial value and every change", async () => {
    const notified: Location[] = [];

    const store = createStore(INITIAL_STATE);
    followSelector(
      store,
      (state) => state.far,
      async (far, controls) => {
        notified.push(far);
      }
    );

    store.write({
      ...store.read(),
      far: timbuktu,
    });
    store.write({
      ...store.read(),
      far: beijing,
    });

    await manyTicks();

    expect(notified.length).toBe(3);
    expect(notified[0]).toEqual(INITIAL_STATE.far);
    expect(notified[1]).toEqual(timbuktu);
    expect(notified[2]).toEqual(beijing);
  });

  test("follower not called for other state changes ", async () => {
    const notified: Location[] = [];

    const store = createStore(INITIAL_STATE);
    followSelector(
      store,
      (state) => state.far,
      async (far, controls) => {
        notified.push(far);
      }
    );

    store.write({
      ...store.read(),
      near: manchester,
    });
    store.write({
      ...store.read(),
      near: birmingham,
    });

    await manyTicks();

    expect(notified.length).toBe(1);
    expect(notified[0]).toEqual(INITIAL_STATE.far);
  });

  test("follower can exit using control object", async () => {
    const store = createStore(INITIAL_STATE);
    const promiseEnding = followSelector<AppState, Location, "exampleEnding">(
      store,
      (state) => state.far,
      async (far, controls) => {
        const { exit } = controls;
        if (far === beijing) {
          return exit("exampleEnding");
        }
      }
    );

    store.write({
      ...store.read(),
      far: timbuktu,
    });
    store.write({
      ...store.read(),
      far: beijing,
    });

    const ending = await promiseEnding;

    expect(ending).toBe("exampleEnding");
  });

  test("follower returning ordinary value doesn't terminate", async () => {
    const store = createStore(INITIAL_STATE);
    let changeCount = 0;
    const promiseEnding = followSelector<AppState, Location, "exampleEnding">(
      store,
      (state) => state.far,
      async () => {
        return changeCount++ as unknown as void; //force non-void return value to test logic
      }
    );

    store.write({
      ...store.read(),
      far: timbuktu,
    });
    store.write({
      ...store.read(),
      far: beijing,
    });

    await manyTicks();

    // follower has handled all changes
    expect(changeCount).toBe(3);

    //promiseEnding not resolved yet - followSelector still running
    const winner = await Promise.race([promiseEnding, Promise.resolve()]);
    expect(typeof winner === "undefined");
  });

  test("follower can access lastSelected()", async () => {
    const store = createStore(INITIAL_STATE);
    const lastSelectedValues: (Location | undefined)[] = [];
    followSelector<AppState, Location, "exampleEnding">(
      store,
      (state) => state.far,
      async (far, controls) => {
        const { lastSelected } = controls;
        const lastSelectedValue = lastSelected();
        lastSelectedValues.push(lastSelectedValue);
      }
    );

    store.write({
      ...store.read(),
      far: timbuktu,
    });
    store.write({
      ...store.read(),
      far: beijing,
    });

    await manyTicks();

    expect(lastSelectedValues).toEqual([
      undefined,
      INITIAL_STATE.far,
      timbuktu,
    ]);
  });

  test("follower throwing terminates implicit loop", async () => {
    const store = createStore(INITIAL_STATE);
    let error;
    try {
      await followSelector<AppState, Location, "exampleEnding">(
        store,
        (state) => state.far,
        async () => {
          throw new Error("I am terminating");
        }
      );
    } catch (e) {
      error = e;
    }
    if (!(error instanceof Error)) {
      throw new Error("Thrown item wasn't an error");
    }
    expect(error.message).toBe("I am terminating");
  });
});
