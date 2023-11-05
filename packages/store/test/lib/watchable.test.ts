import { DefaultWatchable } from "../../src/lib/watchable";
import { DefaultStore } from "../../src/lib/store";

import { vi, describe, test, expect } from "vitest";

describe("BasicWatchable behaviour", () => {
  test("Can create BasicWatchable", () => {
    expect(new DefaultWatchable()).toBeDefined();
  });

  /** Expose protected notify() for testing */
  class Notifiable<T> extends DefaultWatchable<T> {
    public async doNotify(item: T) {
      await this.notify(item);
    }
  }

  test("Can watch BasicWatchable", async () => {
    const notifiable = new Notifiable<string>();
    const watcher = vi.fn();
    notifiable.watch(watcher);
    void notifiable.doNotify("foo");
    await Promise.resolve(); // wait one tick for notifications
    expect(watcher).toHaveBeenCalledWith("foo");
  });

  test("Can unwatch BasicWatchable", async () => {
    const notifiable = new Notifiable<string>();
    const watcher = vi.fn();
    const unwatch = notifiable.watch(watcher);
    unwatch();
    void notifiable.doNotify("foo");
    await Promise.resolve(); // wait one tick for notifications
    expect(watcher).toHaveBeenCalledTimes(0);
  });
});

describe("Store behaviour", () => {
  test("Can create Store", () => {
    expect(new DefaultStore<string>("foo")).toBeDefined();
    expect(new DefaultStore<number>(3)).toBeDefined();
    expect(new DefaultStore<boolean>(true)).toBeDefined();
    expect(new DefaultStore<unknown[]>([])).toBeDefined();
    expect(new DefaultStore<Record<string, unknown>>({})).toBeDefined();
  });

  test("Can watch Store", async () => {
    const store = new DefaultStore<string>("foo");
    const watcher = vi.fn();
    store.watch(watcher);
    store.write("bar");
    await Promise.resolve(); // wait one tick for notifications
    expect(watcher).toHaveBeenCalledWith("bar");
  });

  test("Can watch Store from moment of construction", async () => {
    const watcher = vi.fn();
    const watchers = [watcher];
    const store = new DefaultStore<string>("foo", watchers);
    await Promise.resolve(); // wait one tick for notifications
    expect(watcher).toHaveBeenCalledWith("foo");
    watcher.mockClear();
    store.write("bar");
    await Promise.resolve(); // wait one tick for notifications
    expect(watcher).toHaveBeenCalledWith("bar");
  });

  test("Can construct Store with value", () => {
    const store = new DefaultStore<string>("foo");
    expect(store.read()).toBe("foo");
  });
});
