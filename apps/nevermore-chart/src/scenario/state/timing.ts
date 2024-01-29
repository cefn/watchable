import { edit } from "@watchable/store-edit";
import { STORE_INSTANCE } from "./store";
import { TaskId } from "../task";

interface PromisedTiming {
  // promised, not yet executed
  promised: number;
  executed?: never;
  fulfilled?: never;
  rejected?: never;
}

interface ExecutedTiming {
  // executed not yet settled
  promised: number;
  executed: number;
  fulfilled?: never;
  rejected?: never;
}

interface FulfilledTiming {
  // settled and fulfilled
  promised: number;
  executed: number;
  fulfilled: number;
  rejected?: never;
}

interface RejectedTiming {
  // settled and rejected
  promised: number;
  executed: number;
  fulfilled?: never;
  rejected: number;
}

export type TaskTiming =
  | PromisedTiming
  | ExecutedTiming
  | FulfilledTiming
  | RejectedTiming;

export type EventKind = keyof TaskTiming;

export function now() {
  return new Date().getTime();
}

export function recordTaskEvent(taskId: TaskId, kind: EventKind) {
  // use draft to make edits (write is required)
  edit(STORE_INSTANCE, ({ timings }) => {
    // lazy create a list of timings for this task
    let prevTimings = timings[taskId];
    if (typeof prevTimings === "undefined") {
      prevTimings = [];
      timings[taskId] = prevTimings;
    }

    // 'promised' creates a new current timing record
    if (kind === "promised") {
      // add a new event
      prevTimings.push({
        promised: now(),
      });
      return;
    }

    // others write the time in the current timing record
    const currentTiming = prevTimings.at(-1);
    if (typeof currentTiming === "undefined") {
      throw new Error(`Cannot record ${kind}. No pending event`);
    }
    currentTiming[kind] = now();
  });
}
