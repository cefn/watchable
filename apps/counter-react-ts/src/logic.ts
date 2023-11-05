import type { Store, Immutable } from "@watchable/store";

export type CounterState = Immutable<{
  counter: number;
}>;

export const INITIAL_STATE: CounterState = {
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
