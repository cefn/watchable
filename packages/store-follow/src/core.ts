import { createQueue } from "@lauf/queue";
import { Immutable, RootState, Selector, Store } from "@lauf/store";
import { Controls, Follower, QueueHandler, ExitStatus } from "./types";

/**
 * Configures a [[MessageQueue]] that will receive messages with every new value
 * of a [[Selector]] against a [[Store]]. Passes the queue and the initial value
 * from the Selector to `handleQueue` then waits for `handleQueue` to return,
 * after which the queue is unsubscribed.
 *
 * @param store Store to monitor
 * @param selector Function that extracts the selected value
 * @param handleQueue Function passed the initial selected value and queue
 * @returns the value returned by `handleQueue`
 */
export async function withSelectorQueue<
  State extends RootState,
  Selected,
  Ending
>(
  store: Store<State>,
  selector: Selector<State, Selected>,
  handleQueue: QueueHandler<Immutable<Selected>, Ending>
): Promise<Ending> {
  const queue = createQueue<Immutable<Selected>>();
  //Could be hoisted as a 'SelectorWatchable'
  let prevSelected: Immutable<Selected> = selector(store.read());
  const selectedNotifier = (value: Immutable<State>) => {
    const nextSelected = selector(value);
    if (!Object.is(nextSelected, prevSelected)) {
      prevSelected = nextSelected;
      queue.send(nextSelected);
    }
  };
  const unwatch = store.watch(selectedNotifier); // subscribe future states
  selectedNotifier(store.read()); // notify the initial state
  try {
    return await handleQueue(queue, prevSelected);
  } finally {
    unwatch();
  }
}

/**
 * Invokes the [[Follower|follower]] once with the initial value of
 * [[Selector|selector]] and again every time [[Store|store]] has a changed
 * value of `Selector`. If follower is async, each invocation will
 * be awaited before the next is called.
 *
 * The `follower` is passed the new value each time, and also a
 * [[Controls|control]] object which can be used to exit the loop like `return
 * control.exit(myValue)`. If `follower` doesn't return an exit
 * instruction, its return value is ignored and it will be invoked again
 * on the the next `Selector` change.
 *
 * @param store The store to follow
 * @param selector The function to extract the selected value
 * @param follower The callback to handle each changing value
 * @returns Any `Ending` returned when exiting the loop
 */
export async function followSelector<State extends RootState, Selected, Ending>(
  store: Store<State>,
  selector: Selector<State, Selected>,
  follower: Follower<Selected, Ending>
): Promise<Ending> {
  return await withSelectorQueue(
    store,
    selector,
    async function (queue, selected) {
      const { receive } = queue;
      let result: Ending;
      let lastSelected: Immutable<Selected> | undefined;
      const exitStatus: ExitStatus = ["exit"];
      const controls: Controls<Selected, Ending> = {
        exit(ending: Ending) {
          result = ending;
          return exitStatus;
        },
        lastSelected() {
          return lastSelected;
        },
      };
      while (true) {
        const ending = await follower(selected, controls);
        if (ending === exitStatus) {
          return result!;
        }
        lastSelected = selected;
        selected = await receive();
      }
    }
  );
}
