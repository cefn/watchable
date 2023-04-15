import React, {
  createContext,
  useContext,
  type PropsWithChildren,
} from "react";
import type { Store } from "@lauf/store";
import type { CounterState } from "./logic";

const CounterContext = createContext<Store<CounterState> | null>(null);

export const CounterRoot = ({
  store,
  children,
}: PropsWithChildren & { store: Store<CounterState> }) => {
  return (
    <CounterContext.Provider value={store}>{children}</CounterContext.Provider>
  );
};

export function useCounterStore() {
  const store = useContext(CounterContext);
  if (store === null) {
    throw new Error(`useCounterStore() requires a CounterRoot ancestor`);
  }
  return store;
}
