import type { Immutable, RootState, Watcher } from '../../src/types';
import { createStore, createStorePartition } from '../../src/lib';
import { createStoreSuite, StoreFactory } from '../storeSuite';
import { createDeferred } from '../util';

/** TEST PARTITIONS AS A GENERAL STORE */

/** Creates a store as an object property in a parent store. */
const partitionedMapStoreFactory: StoreFactory = <ChildState extends RootState>(
  childState: Immutable<ChildState>,
  watchers?: ReadonlyArray<Watcher<Immutable<ChildState>>>
) => {
  interface ParentState {
    foo: ChildState;
  }
  const parentState: Immutable<ParentState> = { foo: childState } as const;
  const parentStore = createStore<ParentState>(parentState);
  const childStore = createStorePartition(parentStore, 'foo', watchers);
  return childStore;
};

/** Creates a store as an array entry in a parent store. */
const partitionedListStoreFactory: StoreFactory = <
  ChildState extends RootState
>(
  childState: Immutable<ChildState>,
  watchers?: ReadonlyArray<Watcher<Immutable<ChildState>>>
) => {
  type ParentState = [ChildState];
  const parentState: Immutable<ParentState> = [childState] as const;
  const parentStore = createStore<ParentState>(parentState);
  const childStore = createStorePartition(parentStore, 0, watchers);
  return childStore;
};

createStoreSuite('Partitioned Object Store', partitionedMapStoreFactory);
createStoreSuite('Partitioned Array Store', partitionedListStoreFactory);

/** TEST PARTITIONS INTERACTIONS WITH THEIR PARENT */

describe('Parent Stores and Child Store Partitions', () => {
  interface ParentState {
    partition: {
      roses: 'red' | 'white';
    };
    other: {
      violets: 'blue' | 'purple';
    };
  }

  type ChildState = ParentState['partition'];

  function createPartitionedStores() {
    const parentStore = createStore<ParentState>({
      partition: { roses: 'red' },
      other: { violets: 'blue' },
    });
    const childStore = createStorePartition(parentStore, 'partition');
    return {
      parentStore,
      childStore,
    };
  }
  test('Child watchers notified of parent store assignments inside partition', async () => {
    const { deferred, deferredResolve } = createDeferred<ChildState>();
    const { parentStore, childStore } = createPartitionedStores();
    childStore.watch(deferredResolve);
    // set a deep value
    const parentState = parentStore.read();
    parentStore.write({
      ...parentState,
      partition: {
        ...parentState['partition'],
        roses: 'white',
      },
    });
    expect(await deferred).toBe(childStore.read());
  });

  test('Child watchers not notified of parent store assignments outside partition', async () => {
    const watcher = jest.fn();
    const { parentStore, childStore } = createPartitionedStores();
    childStore.watch(watcher);
    // set a deep value
    const parentState = parentStore.read();
    parentStore.write({
      ...parentState,
      other: {
        ...parentState['other'],
        violets: 'purple',
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(watcher).toHaveBeenCalledTimes(0);
  });

  test('Parent watchers notified of child store assignments inside partition', async () => {
    const { deferred, deferredResolve } = createDeferred<ParentState>();
    const { parentStore, childStore } = createPartitionedStores();
    parentStore.watch(deferredResolve);
    // set a deep value
    const childState = childStore.read();
    childStore.write({
      ...childState,
      roses: 'white',
    });
    expect(await deferred).toBe(parentStore.read());
  });

  test('Parent watchers notified if child store overwrites partition', async () => {
    const { deferred, deferredResolve } = createDeferred<ParentState>();
    const { parentStore, childStore } = createPartitionedStores();
    parentStore.watch(deferredResolve);
    childStore.write({ roses: 'white' });
    expect(await deferred).toBe(parentStore.read());
  });

  test('Child path and Parent path results correspond', () => {
    const { parentStore, childStore } = createPartitionedStores();
    expect(childStore.read().roses).toBe(parentStore.read().partition.roses);
  });
});
