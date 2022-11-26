import { Immutable, Store } from "@lauf/store";

export interface AppState {
  counter: number;
}

export const INITIAL_STATE: Immutable<AppState> = {
  counter: 0,
};

export function increment(store: Store<AppState>) {
  const state = store.read();
  const { counter } = state;
  store.write({
    ...state,
    counter: counter + 1,
  });
}

export function decrement(store: Store<AppState>) {
  const state = store.read();
  const { counter } = state;
  store.write({
    ...state,
    counter: counter - 1,
  });
}
