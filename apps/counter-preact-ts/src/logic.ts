import type { Immutable, Store } from "@watchable/store";

export interface CounterState {
  counter: number;
}

export const INITIAL_STATE: Immutable<CounterState> = {
  counter: 0,
} as const;

export function increment(store: Store<CounterState>) {
  const state = store.read();
  store.write({
    ...state,
    counter: state.counter + 1,
  });
}

export function decrement(store: Store<CounterState>) {
  const state = store.read();
  store.write({
    ...state,
    counter: state.counter - 1,
  });
}
