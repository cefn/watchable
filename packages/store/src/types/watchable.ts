/** Function to be subscribed through {@link Watchable.watch} to be notified of an item T.  */
export type Watcher<T> = (item: T) => unknown;

/** Handle returned from {@link Watchable.watch} that can disable an earlier subscription. */
export type Unwatch = () => void;

/** A subscribable object, accepts {@link Watcher} callbacks, sends notifications of
 * type T . */
export interface Watchable<T> {
  /** Subscribes `watcher` to receive notifications.
   * @typeParam T The type of value notified.
   * @param watcher - The subscribed function.
   * @returns - a callback for unsubscribing
   */
  watch: (watcher: Watcher<T>) => Unwatch;
}

/** A {@link Watchable} encapsulating a changing value which you can {@link write} and {@link read}.
 * @typeParam T The value stored, retrieved and watched.
 */
export interface WatchableState<T> extends Watchable<T> {
  /** Store a new state. */
  write: (state: T) => T;
  /** Retrieve the current state. */
  read: () => T;
}
