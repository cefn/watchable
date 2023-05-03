import type { Store, Selector, Immutable, RootState } from "@watchable/store";
import { createStore } from "@watchable/store";
import { useState, useEffect } from "react";

/** When the component is first mounted, this hook creates and returns a a new
 * long-lived {@link @watchable/store!Store} initialised with `initialState`.
 *
 * In later renders the hook will always return the same `Store`, It
 * deliberately doesn't force a component refresh when the Store state changes.
 * To track changes in the store, see {@link useSelected} or {@link useRootState}.
 *
 * @param initialState
 * @returns A lazily-created {@link @watchable/store!Store}
 */
export function useStore<T extends RootState>(initialState: Immutable<T>) {
  const [store] = useState(() => {
    return createStore(initialState);
  });
  return store;
}

/** A hook for tracking a subpart or a computed value derived from the
 * {@link @watchable/store!RootState} of a {@link @watchable/store!Store} by a
 * {@link @watchable/store!Selector} function.
 *
 * This hook calls `selector` with the `Store`'s `RootState` and returns the
 * derived value. Then it {@link @watchable/store!Watcher watches} the store, calling
 * the `selector` again for every change to the `RootState`. If the value
 * returned by `selector` is not identical to the last saved value, a re-render
 * will be triggered (and this hook will return the new value).
 *
 * If your `selector` constructs a new data structure based on the `RootState`,
 * (rather than just selecting some part of the {@link @watchable/store!Immutable} `RootState` or
 * calculating a primitive value), then it might return a non-identical value
 * even when nothing has changed. Computed data structures should be
 * [memoized](https://github.com/reduxjs/reselect#creating-a-memoized-selector)
 * to minimise component refreshes.
 *
 * See {@link @watchable/store!Selector}
 */
export function useSelected<State extends RootState, Selected>(
  store: Store<State>,
  selector: Selector<State, Selected>
) {
  let [selected, setSelected] = useState(() => selector(store.read()));
  useEffect(() => {
    const maybeSetSelected = (nextState: Immutable<State>) => {
      const nextSelected = selector(nextState); // what's the selected now?
      if (!Object.is(selected, nextSelected)) {
        selected = nextSelected; // sync value in maybeSetSelected closure
        setSelected(nextSelected); // notify changed value
      }
    };
    // handle changes between first render and useEffect
    maybeSetSelected(store.read());
    // handle future changes (returning unwatch function)
    return store.watch(maybeSetSelected);
  }, [store, selector]);
  return selected;
}

/**
 * A hook for tracking the {@link @watchable/store!RootState} of a
 * {@link @watchable/store!Store}. Note, this forces a reload of the component when
 * ***any*** part of the state tree changes. You probably want
 * {@link useSelected} instead.
 * @param store The {@link @watchable/store!Store} to track.
 */
export function useRootState<State extends RootState>(store: Store<State>) {
  const { read, watch } = store;
  const [rootState, setRootState] = useState(read);
  useEffect(() => {
    const unwatch = watch((nextRootState) => {
      setRootState(nextRootState); // set version in state
    });
    return unwatch;
  }, [store]);
  return rootState;
}
