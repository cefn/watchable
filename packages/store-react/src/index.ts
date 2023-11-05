/* eslint-disable symbol-description */
import type { Store, Selector, Immutable, RootState } from "@watchable/store";
import { createStore } from "@watchable/store";
import { useState, useEffect, useMemo, useCallback } from "react";

/** A hook that uses a dummy state to force a render on request. */
function useRenderTrigger() {
  const [_, setTrigger] = useState(0);
  return useCallback(() => {
    setTrigger((trigger) => trigger + 1);
  }, [setTrigger]);
}

/** Memoizes a single argument function. Re-uses the previous result whenever
 * previous argument is identical (according to `Object.is`).
 */
function memoizeUnaryFn<Arg, Ret>(unaryFn: (arg: Arg) => Ret) {
  let previousRun: [Arg, Ret] | null = null;
  const memoizedFn = (arg: Arg) => {
    if (previousRun !== null) {
      const [prevArg, prevRet] = previousRun;
      if (Object.is(arg, prevArg)) {
        return prevRet;
      }
    }
    const ret = unaryFn(arg);
    previousRun = [arg, ret];
    return ret;
  };
  return memoizedFn;
}

/** When the component is first mounted, this hook creates and returns a a new
 * long-lived {@link @watchable/store!Store} initialised with `initialState`.
 *
 * In later renders the hook will always return the same `Store`, It
 * deliberately doesn't force a component refresh when the Store state changes.
 * Any changes to `initialState` after the first render are therefore ignored.
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
 * derived value. Then it {@link @watchable/store!Watcher watches} the store,
 * calling the `selector` again for every change to the `RootState`. If the
 * value returned by `selector` is not identical to the last saved value, a
 * re-render will be triggered (and this hook will return the new value).
 *
 * This hook recomputes its state when the `selector` changes. You should avoid
 * unnecessarily creating a new selector on every render. Selectors can usually
 * be created outside the component to avoid this. If your selector has some
 * prop dependencies, then wrap the selector in a React
 * [useCallback](https://react.dev/reference/react/useCallback) to ensure the
 * reference stays the same as much as possible.
 *
 * If your `selector` constructs a new data structure based on the `RootState`,
 * (rather than just selecting some part of the
 * {@link @watchable/store!Immutable} `RootState` or calculating a primitive
 * value), then it might return a non-identical value even when nothing has
 * changed. This is now prevented because we add a memoizing wrapper to your
 * selector. If state arguments remain the same, we will use the previous value
 * returned _**without executing your selector**_.
 *
 * See {@link @watchable/store!Selector}
 */
export function useSelected<State extends RootState, Selected>(
  store: Store<State>,
  selector: Selector<State, Selected>
) {
  // selected is evaluated both in store watcher and here in component
  // memoizing its args ensures selector is executed maximum once per state change
  const memoizedSelector = useMemo(() => memoizeUnaryFn(selector), [selector]);
  // lazy calculate selected
  let selected = memoizedSelector(store.read());
  // create renderTrigger for use in useEffect
  const renderTrigger = useRenderTrigger();
  useEffect(() => {
    const maybeRender = (nextState: Immutable<State>) => {
      // store state was written - reevaluate selected
      const nextSelected = memoizedSelector(nextState);
      // refresh only when selected is different
      if (!Object.is(selected, nextSelected)) {
        selected = nextSelected; // update selected in useEffect closure
        renderTrigger(); // update selected in hook re-render
      }
    };
    // don't miss edits between initial render and (useEffect) store.watch
    maybeRender(store.read());
    // watch store, (returning unwatch function)
    return store.watch(maybeRender);
  }, [store, memoizedSelector, renderTrigger]);
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
  // trigger for store watcher to force a render
  const renderTrigger = useRenderTrigger();
  useEffect(() => {
    return store.watch(renderTrigger);
  }, [store]);
  return store.read();
}

/** Hook with a [value, setter] signature that parallels React.useState. Reads
 *  and writes an individual keyed property of a store's RootState. */
export function useStateProperty<
  S extends Record<PropertyKey, unknown>,
  K extends keyof S
>(store: Store<S>, key: K) {
  const setter = useCallback(
    (value: S[K]) => {
      store.write({
        ...store.read(),
        [key]: value,
      });
    },
    [store, key]
  );
  const selector = useCallback((state: Immutable<S>) => state[key], [key]);
  const value = useSelected(store, selector);
  return [value, setter] as const;
}
