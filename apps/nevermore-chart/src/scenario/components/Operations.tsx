/* eslint-disable no-cond-assign */
import { useSelected } from "@watchable/store-react";
import {
  OperationName,
  PromiseMoment,
  Scale,
  normalizeMs,
  normalizeTask,
  pc,
} from "../store";
import { TaskId, extractTaskIndex } from "../task";
import { TRACKER_INSTANCE } from "../store";
import { Immutable } from "@watchable/store";

interface InitiatedSnapshot {
  promised: number;
  fulfilled?: never;
  rejected?: never;
}

/** Aggregates multiple momentary events into a renderable props describing the settlement (of a task or attempt at a task). */
type SettledSnapshot =
  | {
      promised: number;
      fulfilled: number;
      rejected?: never;
    }
  | {
      promised: number;
      fulfilled?: never;
      rejected: number;
    };

type OperationSnapshot = InitiatedSnapshot | SettledSnapshot;

/** IterableIterator allows resuming iteration without losing your place. Used
 * in this function, and after value is returned, iteration remains
 * part-completed to be resumed outside this function for subsequent logic steps
 * Not finding any match will leave iterator exhausted.
 */
function extractSnapshot(
  momentIterator: IterableIterator<PromiseMoment>,
  name: OperationName
): OperationSnapshot | null {
  // find initial promised moment
  for (const { operation, status, ms: maybePromisedMs } of momentIterator) {
    if (operation !== name) continue;
    if (status === "promised") {
      // promise found, find settlement in remaining moments
      for (const { operation, status, ms: maybeSettledMs } of momentIterator) {
        if (operation !== name) continue;
        if (status === "fulfilled") {
          // found a fulfilled moment series
          return {
            promised: maybePromisedMs,
            fulfilled: maybeSettledMs,
          };
        } else if (status === "rejected") {
          // found a rejected moment series
          return {
            promised: maybePromisedMs,
            rejected: maybeSettledMs,
          };
        }
      }
      return {
        promised: maybePromisedMs,
      };
    }
  }
  // couldn't find moment series
  return null;
}

function extractTaskSnapshot(
  moments: Immutable<PromiseMoment[]>
): OperationSnapshot | null {
  const momentIterator = moments[Symbol.iterator]();
  return extractSnapshot(momentIterator, "task");
}

function extractAttemptSnapshots(
  moments: Immutable<PromiseMoment[]>
): OperationSnapshot[] | null {
  // iterator reused between extractions
  const momentIterator = moments[Symbol.iterator]();
  // accumulates returned results
  const snapshots: OperationSnapshot[] = [];
  // may traverse iterator multiple times
  for (;;) {
    const settlement = extractSnapshot(momentIterator, "attempt");
    if (settlement === null) {
      break;
    }
    snapshots.push(settlement);
  }
  // only return array if it has snapshots
  if (snapshots.length > 0) {
    return snapshots;
  }
  // return null if there are no snapshots
  return null;
}

function extractSettled(snapshot: OperationSnapshot) {
  const { fulfilled, rejected } = snapshot;
  return typeof fulfilled === "number"
    ? fulfilled
    : typeof rejected === "number"
    ? rejected
    : null;
}

export function Operations({ taskId }: { taskId: TaskId }) {
  const { store } = TRACKER_INSTANCE;
  const scale = useSelected(store, ({ scale }) => scale);
  const taskMoments =
    useSelected(store, ({ moments }) => moments[taskId]) || [];
  const taskSnapshot = extractTaskSnapshot(taskMoments);
  const attemptSnapshots = extractAttemptSnapshots(taskMoments);

  let taskBlock: JSX.Element | null = null;
  if (taskSnapshot) {
    const { promised } = taskSnapshot;
    const settled = extractSettled(taskSnapshot);
    const color = settled !== null ? "blue" : "grey";
    const leftMs = promised;
    const rightMs = settled ? settled : promised + 1;
    taskBlock = <Block {...{ leftMs, rightMs, taskId, color, scale }} />;
  }

  let attemptBlocks: JSX.Element | null = null;
  if (attemptSnapshots) {
    attemptBlocks = (
      <>
        {" "}
        {attemptSnapshots.map((attemptSnapshot) => {
          const { promised } = attemptSnapshot;
          const settled = extractSettled(attemptSnapshot);
        })}
      </>
    );
  }

  return (
    <>
      {taskBlock}
      {attemptBlocks}
    </>
  );
}

function Block(props: {
  leftMs: number;
  rightMs: number;
  taskId: TaskId;
  color: "grey" | "blue" | "red" | "green";
  scale: Scale;
}) {
  const { leftMs, rightMs, taskId, color, scale } = props;
  const taskIndex = extractTaskIndex(taskId);

  const xMs = normalizeMs(scale, leftMs);
  const widthMs = normalizeMs(scale, rightMs) - xMs;
  const yTask = normalizeTask(scale, taskIndex);
  const heightTask = normalizeTask(scale, taskIndex + 1) - yTask;
  const rectProps = {
    x: pc(xMs),
    y: pc(yTask),
    width: pc(widthMs),
    height: pc(heightTask),
  };
  return (
    <rect
      {...rectProps}
      style={{
        color,
      }}
    />
  );
}
