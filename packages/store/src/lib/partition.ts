import type { PartitionableState, Selector, Store, Watcher } from "../types";
import { DefaultWatchable } from "./watchable";

/** Utility class for partitioning of a Store. See {@link createStorePartition}. */
class DefaultStorePartition<
    ParentState extends PartitionableState<Key>,
    Key extends keyof ParentState
  >
  extends DefaultWatchable<ParentState[Key]>
  implements Store<ParentState[Key]>
{
  constructor(
    readonly store: Store<ParentState>,
    readonly key: Key,
    watchers?: ReadonlyArray<Watcher<ParentState[Key]>>
  ) {
    super(watchers);
    void this.notify(this.read());
    this.track();
  }

  private readonly track = () => {
    let lastSubState: ParentState[Key] = this.store.read()[this.key];
    this.store.watch((state) => {
      const subState = state[this.key];
      if (Object.is(subState, lastSubState)) {
        return;
      }
      lastSubState = subState;
      void this.notify(subState);
    });
  };

  read = () => {
    return this.store.read()[this.key];
  };

  write = (state: ParentState[Key]) => {
    const parentState = this.store.read();
    this.store.write({
      ...parentState,
      [this.key]: state,
    });
    return state;
  };

  select = <Selected>(selector: Selector<ParentState[Key], Selected>) => {
    return selector(this.read());
  };
}

/**
 * Constructs a {@link Store} that tracks a child property of another store's
 * {@link RootState}. See {@link PartitionableState} for more details.
 *
 * @param store The parent store containing the partition
 * @param key The child key to partition the parent's state.
 * @param watchers - A list of {@link Watcher | Watchers} to be notified once and permanently subscribed
 * @returns The partitioned store.
 */
export function createStorePartition<
  State extends PartitionableState<Key>,
  Key extends keyof State
>(
  store: Store<State>,
  key: Key,
  watchers?: ReadonlyArray<Watcher<State[Key]>>
): Store<State[Key]> {
  return new DefaultStorePartition(store, key, watchers);
}
