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
  private isLocked: boolean = false;
  private readonly queue: Array<() => void> = [];

  private readonly unlock = (): void => {
    if (this.queue.length > 0) {
      const nextResolve = this.queue.shift();
      if (typeof nextResolve !== "undefined") {
        nextResolve();
      }
    } else {
      this.isLocked = false;
    }
  };

  lock = async (): Promise<Release> => {
    if (this.isLocked) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }
    this.isLocked = true;
    return this.unlock;
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
