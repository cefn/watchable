import type { Immutable, Store } from "@watchable/store";

export interface CounterState {
  counter: number;
}

export const INITIAL_STATE: Immutable<CounterState> = {
  counter: 0,
};

export function increment(store: Store<CounterState>) {
  const state = store.read();
  const { counter } = state;
  store.write({
    ...state,
    counter: counter + 1,
  });
}

export function decrement(store: Store<CounterState>) {
  const state = store.read();
  const { counter } = state;
  store.write({
    ...state,
    counter: counter - 1,
  });
}
