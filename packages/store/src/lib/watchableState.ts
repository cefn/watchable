import { WatchableState, Watcher } from "../types";
import { DefaultWatchable } from "./watchable";

export class DefaultWatchableState<State>
  extends DefaultWatchable<State>
  implements WatchableState<State> {
  protected value!: State;
  constructor(value: State, watchers?: ReadonlyArray<Watcher<State>>) {
    super(watchers);
    this.write(value);
  }

  write = (value: State) => {
    this.value = value;
    void this.notify(value);
    return value;
  };

  read = () => {
    return this.value;
  };
}
