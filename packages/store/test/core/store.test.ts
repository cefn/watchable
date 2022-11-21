import type { Immutable, RootState, Watcher } from '../../src/types';
import { createStore } from '../../src/lib';
import { createStoreSuite, StoreFactory } from '../storeSuite';

const rootStoreFactory: StoreFactory = <State extends RootState>(
  state: Immutable<State>,
  watchers?: ReadonlyArray<Watcher<Immutable<State>>>
) => createStore<State>(state, watchers);

createStoreSuite('Root Store', rootStoreFactory);
