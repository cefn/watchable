import type { RootState, Store, Watcher } from "../types";
import { DefaultWatchable } from "./watchable";

/** Reference implementation of watchable {@link Store}  */
export class DefaultStore<State extends RootState>
  extends DefaultWatchable<State>
  implements Store<State>
{
  protected value!: State;
  constructor(value: State, watchers?: ReadonlyArray<Watcher<State>>) {
    super(watchers);
    this.write(value);
  }

  write = (value: State) => {
    this.value = value;
    void this.notify(value);
    return value;
  };

  read = () => {
    return this.value;
  };
}

/**
 * Initialise a {@link Store} with an initial {@link RootState} - any array,
 * tuple or object. This state can be updated and monitored for updates to drive
 * an app.
 *
 * Ideally your `State` is defined as `Immutable<State>` to prevent
 * inadvertent mutations to state, bypassing `store.write()`)
 * @param initialState - The initial {@link RootState} stored
 * @param watchers - A list of {@link Watcher | Watchers} to be notified once
 * and permanently subscribed
 * @category
 */
export function createStore<State extends RootState>(
  initialState: State,
  watchers?: ReadonlyArray<Watcher<State>>
): Store<State> {
  return new DefaultStore(initialState, watchers);
}
