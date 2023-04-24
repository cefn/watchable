import React, { createContext, useContext, type ReactNode } from "react";
import type { Store } from "@lauf/store";
import type { CounterState } from "./logic";

/** Deliberately not exported. Ensures encapsulation of Context
 * behaviour in this single file.
 */
const CounterContext = createContext<Store<CounterState> | null>(null);

/** Ensures a non-null `store` argument. (react Context API default value is null). */
export const CounterRoot = (props: {
  store: Store<CounterState>;
  children: ReactNode;
}) => {
  return (
    <CounterContext.Provider value={props.store}>
      {props.children}
    </CounterContext.Provider>
  );
};

/** Hook gets store from CounterRoot ancestor. */
export function useCounterStore() {
  const store = useContext(CounterContext);
  if (store === null) {
    throw new Error(`useCounterStore() requires a CounterRoot ancestor`);
  }
  return store;
}
