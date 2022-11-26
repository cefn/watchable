import { createStore } from "@lauf/store";
import { INITIAL_STATE, increment, decrement } from "../../src/logic";

describe("Counter App Business Logic", () => {
  test("Counter is initially 0", () => {
    const store = createStore(INITIAL_STATE);
    const { counter } = store.read();
    expect(counter).toBe(0);
  });

  test("Calling increment increases counter by 1", () => {
    let counter: number;
    const store = createStore(INITIAL_STATE);

    ({ counter } = store.read());
    expect(counter).toBe(0);

    increment(store);

    ({ counter } = store.read());
    expect(counter).toBe(1);
  });

  test("Calling decrement decreases counter by 1", () => {
    let counter: number;
    const store = createStore(INITIAL_STATE);

    ({ counter } = store.read());
    expect(counter).toBe(0);

    decrement(store);

    ({ counter } = store.read());
    expect(counter).toBe(-1);
  });

  test("Repeated calls are all counted", () => {
    let counter: number;
    const store = createStore(INITIAL_STATE);

    ({ counter } = store.read());
    expect(counter).toBe(0);
    const repeats = 100;
    for (let step = 0; step < repeats; step++) {
      increment(store);
    }

    ({ counter } = store.read());
    expect(counter).toBe(repeats);
  });
});
