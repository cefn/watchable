/** Function to be subscribed through [[Watchable.watch]] to be notified of an item T.  */
export type Watcher<T> = (item: T) => unknown;

/** Handle returned from [[Watchable.watch]] that can disable an earlier subscription. */
export type Unwatch = () => void;

/** A subscribable object, accepts [[Watcher]] callbacks, sends notifications of
 * type T . */
export interface Watchable<T> {
  /** Subscribes `watcher` to receive notifications.
   * @typeParam T The type of value notified.
   * @param watcher - The subscribed function.
   * @returns - a callback for unsubscribing
   */
  watch: (watcher: Watcher<T>) => Unwatch;
}

/** A [[Watchable]] encapsulating a changing value which you can [[write]] and [[read]].
 * @typeParam T The value stored, retrieved and watched.
 */
export interface WatchableState<T> extends Watchable<T> {
  /** Store a new state. */
  write: (state: T) => T;
  /** Retrieve the current state. */
  read: () => T;
}
