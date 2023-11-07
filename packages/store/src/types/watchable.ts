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
