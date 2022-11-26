import { Immutable, RootState, Store } from "@lauf/store";
import produce from "immer";
import { Editor } from "./types";

/** Accepts an [[Editor]] function which will be passed a `draft` of the current
 * state. The function can manipulate the draft state using normal javascript
 * assignments and operations as if it ***wasn't*** [[Immutable]]. When it
 * returns, [[write]] will be called on your behalf with the equivalent
 * [[Immutable]] result.
 * @param editor A function to draft the next state
 * @returns The resulting new [[Immutable]] state aligned with your draft changes. */
export function edit<State extends RootState>(
  store: Store<State>,
  editor: Editor<State>
) {
  const nextState = produce<State>(store.read() as State, (draft) => {
    editor(draft);
  }) as unknown as Immutable<State>;
  return store.write(nextState);
}
