import { DefaultWatchable } from '../../src/lib/watchable';
import { DefaultWatchableState } from '../../src/lib/watchableState';

describe('BasicWatchable behaviour', () => {
  test('Can create BasicWatchable', () => {
    expect(new DefaultWatchable()).toBeDefined();
  });

  /** Expose protected notify() for testing */
  class Notifiable<T> extends DefaultWatchable<T> {
    public async doNotify(item: T) {
      return await this.notify(item);
    }
  }

  test('Can watch BasicWatchable', async () => {
    const notifiable = new Notifiable<string>();
    const watcher = jest.fn();
    notifiable.watch(watcher);
    void notifiable.doNotify('foo');
    await Promise.resolve(); // wait one tick for notifications
    expect(watcher).toHaveBeenCalledWith('foo');
  });

  test('Can unwatch BasicWatchable', async () => {
    const notifiable = new Notifiable<string>();
    const watcher = jest.fn();
    const unwatch = notifiable.watch(watcher);
    unwatch();
    void notifiable.doNotify('foo');
    await Promise.resolve(); // wait one tick for notifications
    expect(watcher).toHaveBeenCalledTimes(0);
  });
});

describe('BasicWatchableValue behaviour', () => {
  test('Can create BasicWatchableValue', () => {
    expect(new DefaultWatchableState<string>('foo')).toBeDefined();
    expect(new DefaultWatchableState<number>(3)).toBeDefined();
    expect(new DefaultWatchableState<boolean>(true)).toBeDefined();
    expect(new DefaultWatchableState<unknown[]>([])).toBeDefined();
    expect(
      new DefaultWatchableState<Record<string, unknown>>({})
    ).toBeDefined();
  });

  test('Can watch BasicWatchableValue', async () => {
    const watchableValue = new DefaultWatchableState<string>('foo');
    const watcher = jest.fn();
    watchableValue.watch(watcher);
    watchableValue.write('bar');
    await Promise.resolve(); // wait one tick for notifications
    expect(watcher).toHaveBeenCalledWith('bar');
  });

  test('Can watch BasicWatchableValue from moment of construction', async () => {
    const watcher = jest.fn();
    const watchers = [watcher];
    const watchableValue = new DefaultWatchableState<string>('foo', watchers);
    await Promise.resolve(); // wait one tick for notifications
    expect(watcher).toHaveBeenCalledWith('foo');
    watcher.mockClear();
    watchableValue.write('bar');
    await Promise.resolve(); // wait one tick for notifications
    expect(watcher).toHaveBeenCalledWith('bar');
  });

  test('Can construct BasicWatchableValue with value', () => {
    const watchableValue = new DefaultWatchableState<string>('foo');
    expect(watchableValue.read()).toBe('foo');
  });
});
