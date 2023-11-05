import type { RootState, Watcher } from "../../src/types";
import type { StoreFactory } from "../storeSuite";
import { createStore } from "../../src/lib";
import { createStoreSuite } from "../storeSuite";

const rootStoreFactory: StoreFactory = <State extends RootState>(
  state: State,
  watchers?: ReadonlyArray<Watcher<State>>
) => createStore<State>(state, watchers);

createStoreSuite("Root Store", rootStoreFactory);
