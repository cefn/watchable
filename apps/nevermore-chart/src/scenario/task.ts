export type TaskId = `task_${number}`;

export function createTaskId(index: number): TaskId {
  return `task_${index}`;
}

export function extractTaskIndex(taskId: TaskId) {
  const [_, taskIndexString] = taskId.split("_");
  return Number.parseInt(taskIndexString);
}

/** A mock async task function (writes transition events to the store). */
export function promiseAttempt(options: {
  taskId: TaskId;
  durationMs: number;
  successful?: boolean;
}): Promise<void> {
  const { durationMs, successful = true } = options;
  return new Promise<void>((resolve, reject) =>
    setTimeout(() => {
      if (successful) {
        resolve();
      } else {
        reject();
      }
    }, durationMs)
  );
}
