import { createExecutorStrategy } from "@watchable/nevermore";
import { recordTaskEvent } from "./state/timing";
import { createTaskId, performTask } from "./task";

const TASK_COUNT = 20;
const TASK_DURATION_MS = 10;

export async function launchAllSettled() {
  // create a strategy for limiting execution of tasks
  const { createExecutor } = createExecutorStrategy({ concurrency: 1 });

  // create a strategy-limited version of the
  const performTaskExecutor = createExecutor(performTask);

  // wrap all tasks in executors and promise executor results
  const promiseList = Array.from({ length: TASK_COUNT }).map((_, index) => {
    const taskId = createTaskId(index);
    // notify that task was scheduled
    recordTaskEvent(taskId, "promised");
    // schedule task (executor may delay task start )
    performTaskExecutor({
      taskId,
      durationMs: TASK_DURATION_MS,
    });
  });

  await Promise.allSettled(promiseList);
}
