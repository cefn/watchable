/**
 * A Release function issued to a caller when they acquire a [[Lock]] on a
 * particular key. The caller is expected to invoke this function to give up the
 * lock and allow other processes to enter the mutual exclusion for that key. */
export type Release = () => void;

/**
 * A mechanism for mutual exclusion of concurrent processes. For a given value,
 * one process can acquire the `Lock` at one time until it triggers a
 * [[Release]] callback. Others may be waiting their turn, holding a Promise of
 * a future [[Release]] callback of their own.
 */
export interface Mutex {
  /**
   * Acquires the `Lock` for some `Key` value. A caller receives a Promise.
   * While another caller has the lock, the Promise will not resolve. When the
   * caller's turn arises, it will resolve to a [[Release]] function The lock
   * then belongs to the caller from the moment the `Release` Promise resolves,
   * and until the caller invokes the `Release` function to indicate their turn
   * is over.
   */
  lock: () => Promise<Release>;
}

class DefaultMutex implements Mutex {
  private unlockPromise: Promise<void> | null = null;
  lock = async () => {
    let release!: Release;
    while (this.unlockPromise !== null) {
      await this.unlockPromise;
    }
    // nobody has lock, issue to yourself and promise to release it
    this.unlockPromise = new Promise<void>((resolve) => {
      release = () => {
        this.unlockPromise = null;
        resolve();
      };
    });
    return release;
  };
}

/**
 * Create a [[Lock]] to assert mutual exclusion for
 * values of type `Key`
 * @returns
 */
export function createMutex(): Mutex {
  return new DefaultMutex();
}
