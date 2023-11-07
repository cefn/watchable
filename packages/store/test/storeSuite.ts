import type { Immutable, RootState, Store, Watcher } from "../src/types";
import { createDeferred, safeEntries } from "./util";

import { describe, test, expect } from "vitest";

/** Defining a factory allows us to run the same test suite across stores and partitioned stores. */
export type StoreFactory = <State extends RootState>(
  state: Immutable<State>,
  watchers?: ReadonlyArray<Watcher<Immutable<State>>>
) => Store<State>;

export function createStoreSuite(
  suiteName: string,
  storeFactory: StoreFactory
) {
  describe(`${suiteName}: Core behaviour`, () => {
    test("Create Store with Array root", () => {
      const state: number[] = [3, 4, 5];
      expect(storeFactory<typeof state>(state).read()).toEqual(state);
    });

    test("Create Store with Record root", () => {
      const state: Record<string, number> = { pi: 3.1415926 };
      expect(storeFactory<typeof state>(state).read()).toEqual(state);
    });

    test("Create Store with string root", () => {
      const state: string = "hello world";
      expect(storeFactory<typeof state>(state).read()).toEqual(state);
    });

    test("Create Store with number root", () => {
      const state: number = 42;
      expect(storeFactory<typeof state>(state).read()).toEqual(state);
    });

    test("Create Store with boolean root", () => {
      const state: boolean = true;
      expect(storeFactory<boolean>(state).read()).toEqual(state);
    });

    test("Create Store with null root", () => {
      // a null root is not normal but this test
      // should reveal issues with the now very broad typing of RootState
      const state = null;
      expect(storeFactory<null>(state).read()).toEqual(state);
    });

    test("Create Store with undefined root", () => {
      // an undefined root is not normal but this test
      // should reveal issues with the now very broad typing of RootState
      const state = undefined;
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      expect(storeFactory<typeof state>(state).read()).toEqual(state);
    });

    test("Store with optional root handles state transition to undefined", () => {
      let state = "foo" satisfies string | undefined as string | undefined;
      const store = storeFactory<typeof state>(state);
      expect(store.read()).toEqual(state);
      state = undefined;
      store.write(state);
    });

    test("Create Store and pass watchers who are notified", async () => {
      type State = Record<string, number>;
      const state: State = { pi: 3.1415926 };
      const { deferredResolve, deferred } = createDeferred<State>();
      const watchers = [deferredResolve] as const;
      storeFactory(state, watchers);
      expect(await deferred).toBe(state);
    });

    test("Can write Store state", () => {
      const store = storeFactory<Record<string, string[]>>({
        ancient: ["Roses are red", "Violets are blue"],
      });
      const state = store.write({
        ...store.read(),
        modern: ["Sugar is sweet", "So are you"],
      });
      expect(state).toEqual({
        ancient: ["Roses are red", "Violets are blue"],
        modern: ["Sugar is sweet", "So are you"],
      });
    });

    test("Watchers notified of writes", async () => {
      type State = Record<string, string[]>;
      const { deferred, deferredResolve } = createDeferred<Immutable<State>>();
      const store = storeFactory<State>({
        ancient: ["Roses are red", "Violets are blue"],
      });
      store.watch(deferredResolve);
      const nextState = store.write({
        ...store.read(),
        modern: ["Sugar is sweet", "So are you"],
      });
      expect(nextState).toEqual({
        ancient: ["Roses are red", "Violets are blue"],
        modern: ["Sugar is sweet", "So are you"],
      });
      expect(await deferred).toBe(nextState);
    });

    test("Store methods are bound to store", async () => {
      const state = { pi: 3.1415926 };
      const store = storeFactory<Record<string, number>>(state);

      // it should be possible to destructure every method
      // and use it on its own
      safeEntries(store).forEach(([methodName]) => {
        try {
          if (methodName === "read") {
            const { read } = store;
            read();
            return;
          }
          if (methodName === "watch") {
            const { watch } = store;
            const unwatch = watch(() => {});
            unwatch();
            return;
          }
          if (methodName === "write") {
            const { write } = store;
            write({ pi: 22 / 7 });
            return;
          }
          methodName satisfies never;
        } catch (err) {
          throw new Error(`${methodName} may not be bound properly`);
        }
      });
    });
  });
}
