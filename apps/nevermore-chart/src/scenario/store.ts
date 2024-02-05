import { Immutable, createStore } from "@watchable/store";
import { followSelector } from "@watchable/store-follow";
import { edit } from "@watchable/store-edit";
import { TaskId, extractTaskIndex } from "./task";

export const OPERATION_NAME = ["task", "attempt"] as const;

export const STATUS_NAMES = ["promised", "fulfilled", "rejected"] as const;

export interface Scale {
  minMs: number;
  maxMs: number;
  minTask: number;
  maxTask: number;
}

export type OperationName = MemberOf<typeof OPERATION_NAME>;
export type StatusName = MemberOf<typeof STATUS_NAMES>;

export interface PromiseMoment {
  operation: OperationName;
  status: StatusName;
  ms: number;
}

export type State = Immutable<{
  scale: Scale;
  moments: Partial<Record<TaskId, PromiseMoment[]>>;
}>;

type MemberOf<Arr extends readonly unknown[]> = Arr[number];

export function now() {
  return new Date().getTime();
}

export function normalizeMs({ minMs, maxMs }: Scale, ms: number) {
  return (ms - minMs) / (maxMs - minMs);
}

export function normalizeTask({ minTask, maxTask }: Scale, taskIndex: number) {
  return (taskIndex - minTask) / (maxTask - minTask);
}

export function pc(normal: number) {
  return `${100 * normal}%`;
}

export function createTracker() {
  const store = createStore<State>({
    scale: {
      minMs: now(),
      maxMs: now() + 1,
      minTask: 0,
      maxTask: 1,
    },
    moments: {},
  });

  // update the millisecond range after every timing written
  followSelector(
    store,
    ({ moments }) => moments,
    async (timings) => {
      edit(store, ({ scale }) => {
        scale.maxMs = now() + 1;
        scale.maxTask = Object.keys(timings).length;
      });
    }
  );

  function recordMoment(
    taskId: TaskId,
    operation: OperationName,
    event: StatusName
  ) {
    const ms = now();

    edit(store, ({ moments }) => {
      // lazy create a list of moments for this task
      let taskMoments = moments[taskId];
      if (typeof taskMoments === "undefined") {
        taskMoments = [];
        moments[taskId] = taskMoments;
      }

      // add new event to list
      taskMoments.push({
        operation,
        status: event,
        ms,
      });
    });
  }

  return {
    store,
    recordMoment,
  };
}

export const TRACKER_INSTANCE = createTracker();

export function trackOperation<T>(
  taskId: TaskId,
  name: OperationName,
  promise: Promise<T>
) {
  TRACKER_INSTANCE.recordMoment(taskId, name, "promised");
  promise.then(() => TRACKER_INSTANCE.recordMoment(taskId, name, "fulfilled"));
  promise.catch(() => TRACKER_INSTANCE.recordMoment(taskId, name, "rejected"));
  return promise;
}
