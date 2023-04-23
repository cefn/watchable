import type { RootState, Store, Watcher } from "../types";
import type { Immutable } from "../types/immutable";
import { DefaultWatchableState } from "./watchableState";

// commented

/** Reference implementation of Lauf {@link Store}  */
class DefaultStore<State extends RootState>
  extends DefaultWatchableState<Immutable<State>>
  implements Store<State> {}

/** Initialise a {@link Store} with an {@link Immutable} initial {@link RootState} - any
 * array, tuple or object. This state can be updated and monitored for updates
 * to drive an app.
 * @param initialState - The initial {@link RootState} stored
 * @param watchers - A list of {@link Watcher | Watchers} to be notified once and permanently subscribed
 * @category
 */
export function createStore<State extends RootState>(
  initialState: Immutable<State>,
  watchers?: ReadonlyArray<Watcher<Immutable<State>>>
): Store<State> {
  return new DefaultStore(initialState, watchers);
}
