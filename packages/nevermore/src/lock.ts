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
export interface Lock<Key> {
  /**
   * Acquires the `Lock` for some `Key` value. A caller receives a Promise.
   * While another caller has the lock, the Promise will not resolve. When the
   * caller's turn arises, it will resolve to a [[Release]] function The lock
   * then belongs to the caller from the moment the `Release` Promise resolves,
   * and until the caller invokes the `Release` function to indicate their turn
   * is over.
   */
  acquire: (key?: Key) => Promise<Release>;
}

function arrayWithout<T>(arr: ReadonlyArray<T>, index: number) {
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

class DefaultLock<Key> implements Lock<Key> {
  protected keys: ReadonlyArray<Key | void> = [];
  protected releasePromises: ReadonlyArray<Promise<void>> = [];
  acquire = async (key?: Key) => {
    let release = null;
    do {
      const index = this.keys.indexOf(key);
      if (index === -1) {
        //nobody has lock, issue to yourself and promise to release it
        const unlockPromise = new Promise<void>((resolve) => {
          release = () => {
            //remove record of lock
            const index = this.keys.indexOf(key);
            this.keys = arrayWithout(this.keys, index);
            this.releasePromises = arrayWithout(this.releasePromises, index);
            resolve();
          };
        });
        //add record of lock and release promise
        this.keys = [...this.keys, key];
        this.releasePromises = [...this.releasePromises, unlockPromise];
        //return callback to release lock
      } else {
        //await whoever currently has the lock
        await this.releasePromises[index];
      }
    } while (release === null);
    return release;
  };
}

/**
 * Create a [[Lock]] to assert mutual exclusion for
 * values of type `Key`
 * @returns
 */
export function createLock<Key = any>() {
  return new DefaultLock<Key>();
}
