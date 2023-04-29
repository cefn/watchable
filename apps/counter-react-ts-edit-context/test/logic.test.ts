import { createStore } from "@lauf/store";
import { edit } from "@lauf/store-edit";
import { INITIAL_STATE } from "../src/logic";

import { describe, test, expect } from "vitest";

describe("Counter App Business Logic", () => {
  test("Counter is initially 0", () => {
    const store = createStore(INITIAL_STATE);
    const { counter } = store.read();
    expect(counter).toBe(0);
  });

  test("Repeated calls are all counted", () => {
    let counter: number;
    const store = createStore(INITIAL_STATE);

    ({ counter } = store.read());
    expect(counter).toBe(0);
    const repeats = 100;
    for (let step = 0; step < repeats; step++) {
      edit(store, (draft) => {
        draft.counter += 1;
      });
    }

    ({ counter } = store.read());
    expect(counter).toBe(repeats);
  });
});
