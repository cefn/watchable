import { Watchable, Watcher } from "../types/watchable";

export class DefaultWatchable<Value> implements Watchable<Value> {
  protected watchers: ReadonlyArray<Watcher<Value>>;
  constructor(watchers: ReadonlyArray<Watcher<Value>> = []) {
    this.watchers = watchers;
  }

  protected notify = async (item: Value) => {
    const watchers = this.watchers;
    await Promise.resolve(); // equivalent to queueMicrotask()
    for (const watcher of watchers) {
      watcher(item);
    }
  };

  watch = (watcher: Watcher<Value>) => {
    this.watchers = [...this.watchers, watcher];
    return () => {
      this.watchers = this.watchers.filter(
        (candidate) => candidate !== watcher
      );
    };
  };
}
