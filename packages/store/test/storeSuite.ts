import type { Immutable, RootState, Store, Watcher } from '../src/types';
import { createDeferred } from './util';

/** Defining a factory allows us to run the same test suite across stores and  partitioned stores. */
export type StoreFactory = <State extends RootState>(
  state: Immutable<State>,
  watchers?: ReadonlyArray<Watcher<Immutable<State>>>
) => Store<State>;

export function createStoreSuite(
  suiteName: string,
  storeFactory: StoreFactory
) {
  describe(`${suiteName}: Core behaviour`, () => {
    test('Create Store with list root', () => {
      const state = [3, 4, 5];
      expect(storeFactory<number[]>(state).read()).toEqual(state);
    });

    test('Create Store with map root', () => {
      const state = { pi: 3.1415926 };
      expect(storeFactory<Record<string, number>>(state).read()).toEqual(state);
    });

    test('Create Store and pass watchers who are notified', async () => {
      type State = Record<string, number>;
      const state: State = { pi: 3.1415926 };
      const { deferredResolve, deferred } = createDeferred<State>();
      const watchers = [deferredResolve] as const;
      storeFactory(state, watchers);
      expect(await deferred).toBe(state);
    });

    test('Can write Store state', () => {
      const store = storeFactory<Record<string, string[]>>({
        ancient: ['Roses are red', 'Violets are blue'],
      });
      const state = store.write({
        ...store.read(),
        modern: ['Sugar is sweet', 'So are you'],
      });
      expect(state).toEqual({
        ancient: ['Roses are red', 'Violets are blue'],
        modern: ['Sugar is sweet', 'So are you'],
      });
    });

    test('Watchers notified of writes', async () => {
      type State = Record<string, string[]>;
      const { deferred, deferredResolve } = createDeferred<Immutable<State>>();
      const store = storeFactory<State>({
        ancient: ['Roses are red', 'Violets are blue'],
      });
      store.watch(deferredResolve);
      const nextState = store.write({
        ...store.read(),
        modern: ['Sugar is sweet', 'So are you'],
      });
      expect(nextState).toEqual({
        ancient: ['Roses are red', 'Violets are blue'],
        modern: ['Sugar is sweet', 'So are you'],
      });
      expect(await deferred).toBe(nextState);
    });
  });
}
