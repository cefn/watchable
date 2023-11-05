import type { Immutable } from "@watchable/store";

export type CounterState = Immutable<{
  counter: number;
}>;

export const INITIAL_STATE: CounterState = {
  counter: 0,
} as const;
