import type { Immutable, RootState, Store } from "@lauf/store";
import type { Editor } from "./types";
import { produce } from "immer";

/** Accepts an {@link Editor} function which will be passed a `draft` of the current
 * state. The function can manipulate the draft state using normal javascript
 * assignments and operations as if it ***wasn't*** {@link @lauf/store.Immutable}. When it
 * returns, {@link @lauf/store.Store#write} will be called on your behalf with the equivalent
 * {@link @lauf/store.Immutable} result.
 * @param editor A function to draft the next state
 * @returns The resulting new {@link @lauf/store.Immutable} state aligned with your draft changes. */
export function edit<State extends RootState>(
  store: Store<State>,
  editor: Editor<State>
) {
  const nextState = produce<State>(store.read() as State, (draft) => {
    editor(draft);
  }) as unknown as Immutable<State>;
  return store.write(nextState);
}
