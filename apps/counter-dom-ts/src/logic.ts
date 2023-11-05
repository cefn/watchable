import type { Store, Immutable } from "@watchable/store";

export type CounterState = Immutable<{
  counter: number;
}>;

export const INITIAL_STATE: CounterState = {
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
