import type { Immutable, RootState, Watcher } from "../../src/types";
import type { StoreFactory } from "../storeSuite";
import { createStore } from "../../src/lib";
import { createStoreSuite } from "../storeSuite";

const rootStoreFactory: StoreFactory = <State extends RootState>(
  state: Immutable<State>,
  watchers?: ReadonlyArray<Watcher<Immutable<State>>>
) => createStore<State>(state, watchers);

createStoreSuite("Root Store", rootStoreFactory);
