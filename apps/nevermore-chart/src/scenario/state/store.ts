import { Immutable, createStore } from "@watchable/store";
import { Scale } from "./scale";
import { TaskTiming, now } from "./timing";
import { TaskId } from "../task";
import { followSelector } from "@watchable/store-follow";
import { edit } from "@watchable/store-edit";

export type State = Immutable<{
  scale: Scale;
  timings: Partial<Record<TaskId, TaskTiming[]>>;
}>;

export const STORE_INSTANCE = createStore<State>({
  scale: {
    minMs: now(),
    maxMs: now() + 1,
    minTask: 0,
    maxTask: 1,
  },
  timings: {},
});

// update the millisecond range after every timing written
followSelector(
  STORE_INSTANCE,
  ({ timings }) => timings,
  async (timings) => {
    edit(STORE_INSTANCE, ({ scale }) => {
      scale.maxMs = now() + 1;
      scale.maxTask = Object.keys(timings).length;
    });
  }
);
