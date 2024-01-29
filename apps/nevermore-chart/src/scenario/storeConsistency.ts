/** UTILITY METHODS TO CHECK EVENT CONSISTENCY - CONSIDER DELETING - THEY ARE NOT NEEDED AS TYPE GUARDS. */

import {
  STORE_INSTANCE,
  TaskEventKind,
  TaskId,
  TaskTiming,
} from "./state/store";

function assertHasAllTimes(timing: TaskTiming, ...kinds: TaskEventKind[]) {
  return kinds.forEach((kind) => {
    if (typeof timing[kind] !== "number") {
      throw new Error(
        `Inconsistent history: Expected time for ${kind} in ${JSON.stringify(
          timing
        )}`
      );
    }
  });
}

function assertHasSomeTimes(timing: TaskTiming, ...kinds: TaskEventKind[]) {
  if (!kinds.some((kind) => typeof timing[kind] === "number")) {
    throw new Error(
      `Inconsistent history: Expected time for one of ${JSON.stringify(
        kinds
      )} in ${JSON.stringify(timing)}`
    );
  }
}

function assertHasNoTimes(timing: TaskTiming, ...kinds: TaskEventKind[]) {
  return kinds.forEach((kind) => {
    if (typeof timing[kind] === "number") {
      throw new Error(
        `Inconsistent history: Expected no time for ${kind} in ${JSON.stringify(
          timing
        )}`
      );
    }
  });
}

export function assertStateAccepts(taskId: TaskId, kind: TaskEventKind) {
  const { timings } = STORE_INSTANCE.read();

  // get task timings
  const prevTimings = timings[taskId];

  if (typeof prevTimings === "undefined") {
    if (kind === "promised") {
      // 'promised' can create a new timings array
      return;
    }
    throw new Error(`Cannot record ${kind}. There is no pending timing`);
  }

  // get last task timing
  const currentTiming = prevTimings.at(-1);

  if (typeof currentTiming === "undefined") {
    if (kind === "promised") {
      // 'promised' can create a new timing object
      return;
    }

    throw new Error(`Cannot record ${kind}. There is no pending timing`);
  }

  // check previous was complete (promise will create a new timing)
  if (kind === "promised") {
    assertHasAllTimes(currentTiming, "promised", "executed");
    assertHasSomeTimes(currentTiming, "fulfilled", "rejected");
    return;
  }

  // check current is compatible with proposed event...

  if (kind === "executed") {
    assertHasAllTimes(currentTiming, "promised");
    assertHasNoTimes(currentTiming, "executed", "fulfilled", "rejected");
    return;
  }

  if (kind === "fulfilled") {
    assertHasAllTimes(currentTiming, "promised", "executed");
    assertHasNoTimes(currentTiming, "fulfilled", "rejected");
    return;
  }

  if (kind === "rejected") {
    assertHasAllTimes(currentTiming, "promised", "executed");
    assertHasNoTimes(currentTiming, "fulfilled", "rejected");
    return;
  }

  // ensure all cases handled
  kind satisfies never;
}
