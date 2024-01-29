import { recordTaskEvent } from "./state/timing";

export type TaskId = `task_${number}`;

export function createTaskId(index: number): TaskId {
  return `task_${index}`;
}

export function extractTaskIndex(taskId: TaskId) {
  const [_, taskIndexString] = taskId.split("_");
  return Number.parseInt(taskIndexString);
}

/** A mock async task function (writes transition events to the store). */
export function performTask(options: {
  taskId: TaskId;
  durationMs: number;
  successful?: boolean;
}): Promise<void> {
  const { taskId, durationMs, successful = true } = options;
  // notify that task was invoked
  recordTaskEvent(taskId, "executed");
  return new Promise<void>((resolve, reject) =>
    setTimeout(() => {
      if (successful) {
        // notify finished with success
        recordTaskEvent(taskId, "fulfilled");
        resolve();
      } else {
        // notify finished with failure
        recordTaskEvent(taskId, "rejected");
        reject();
      }
    }, durationMs)
  );
}
