import { TaskId, extractTaskIndex } from "../task";

export interface Scale {
  minMs: number;
  maxMs: number;
  minTask: number;
  maxTask: number;
}

export function normalizeTask({ minTask, maxTask }: Scale, taskId: TaskId) {
  const taskIndex = extractTaskIndex(taskId);
  return (taskIndex - minTask) / (maxTask - minTask);
}

export function normaliseMs({ minMs, maxMs }: Scale, ms: number) {
  return (ms - minMs) / (maxMs - minMs);
}

export function pc(normal: number) {
  return `${100 * normal}%`;
}
