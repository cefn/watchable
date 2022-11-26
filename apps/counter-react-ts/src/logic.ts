import { Immutable, Store } from "@lauf/store";

export interface AppState {
  counter: number;
}

export const INITIAL_STATE: Immutable<AppState> = {
  counter: 0,
} as const;

export function increment(store: Store<AppState>) {
  const { counter } = store.read();
  store.write({
    counter: counter + 1,
  });
}

export function decrement(store: Store<AppState>) {
  const { counter } = store.read();
  store.write({
    counter: counter - 1,
  });
}
