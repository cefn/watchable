import { type Store } from "@watchable/store";
import React, { type ReactNode, createContext, useContext } from "react";

/**
 * Configures a React.Context to provide a Store to descendants.
 *
 * If you don't configure either...
 * * a StoreProvider ancestor
 * * the global singleton `defaultStore`
 *
 * ...then a component using the useStoreContext() hook deliberately triggers a
 * runtime error.
 * @param defaultStore Store optionally used as the default global store.
 * @returns a StoreProvider component, and corresponding useStoreContext hook.
 */
export function createStoreContext<State>(defaultStore?: Store<State>) {
  const StoreContext = createContext<Store<State> | null>(defaultStore ?? null);

  /** Ancestor providing a configured Store to descendant React components */
  function StoreProvider({
    store,
    children,
  }: {
    store: Store<State>;
    children: ReactNode;
  }) {
    return (
      <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
    );
  }

  /** Retrieves the current `Store<State>` from the context, or throws an Error
   * if none is available.
   */
  function useStoreContext() {
    const store = useContext(StoreContext);
    if (store === null) {
      throw new Error(`useStoreContext() requires a StoreProvider ancestor`);
    }
    return store;
  }

  return {
    StoreProvider,
    useStoreContext,
  };
}
