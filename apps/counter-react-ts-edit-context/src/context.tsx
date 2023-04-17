import React, {
  createContext,
  useContext,
  type PropsWithChildren,
} from "react";
import type { Store } from "@lauf/store";
import type { CounterState } from "./logic";

/** Deliberately not exported. Ensures encapsulation of Context
 * behaviour in this single file.
 */
const CounterContext = createContext<Store<CounterState> | null>(null);

/** Requires a concrete `store` argument. Ensures no CounterContext.Provider is
 * actually passed a null value (react Context API default value is null). */
export const CounterRoot = ({
  store,
  children,
}: PropsWithChildren & { store: Store<CounterState> }) => {
  return (
    <CounterContext.Provider value={store}>{children}</CounterContext.Provider>
  );
};

/** Hook to get store from CounterContext.Provider ancestor. */
export function useCounterStore() {
  const store = useContext(CounterContext);
  if (store === null) {
    throw new Error(`useCounterStore() requires a CounterRoot ancestor`);
  }
  return store;
}
