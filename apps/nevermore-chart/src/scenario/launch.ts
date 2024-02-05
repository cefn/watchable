import { createExecutorStrategy } from "@watchable/nevermore";
import { createTaskId, promiseAttempt } from "./task";
import { trackOperation } from "./store";

const TASK_COUNT = 20;
const TASK_DURATION_MS = 10;

export async function launchAllSettled() {
  // create a strategy for limiting execution of tasks
  const { createExecutor } = createExecutorStrategy({ concurrency: 1 });

  // create a tracked version of promiseAttempt
  // (wraps promiseAttempt to intercept its promise, write updates to store)
  const trackedPromiseAttempt: typeof promiseAttempt = (options) =>
    trackOperation(
      options.taskId,
      "attempt",
      // attempts task
      promiseAttempt(options)
    );

  // create a strategy-limited version of promiseAttempt
  const promiseAttemptExecutor = createExecutor(trackedPromiseAttempt);

  // invoke strategy-limited promiseAttempt multiple times
  const promiseList = Array.from({ length: TASK_COUNT }).map((_, index) => {
    const taskId = createTaskId(index);
    // intercept promise for viewer
    trackOperation(
      taskId,
      "task",
      // schedules task (executor may delay task start )
      promiseAttemptExecutor({
        taskId,
        durationMs: TASK_DURATION_MS,
      })
    );
  });

  // await all eventual resolutions of promiseAttempt executors
  await Promise.allSettled(promiseList);
}
