import type { RootState, Store } from "@watchable/store";
import type { Editor } from "./types";
import { produce } from "immer";

/** Accepts an {@link Editor} function which will be passed a `draft` of the
 * current state. The function can manipulate the draft state using normal
 * javascript assignments and operations as if it didn't need to be treated as
 * immutable. When it returns, {@link @watchable/store.Store#write} will be
 * called on your behalf with a newly constructed data structure, equivalent to
 * the original plus your edits, but without changing your original.
 * @param editor A function to draft the next state
 * @returns The resulting new state aligned
 * with your draft changes. */
export function edit<State extends RootState>(
  store: Store<State>,
  editor: Editor<State>
) {
  const nextState = produce<State>(store.read(), (draft) => {
    editor(draft);
  });
  return store.write(nextState);
}
