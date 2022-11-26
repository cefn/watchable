/* eslint-disable @typescript-eslint/ban-types */
import type { Draft } from "immer";

/**  A function passed to [[edit]]. The editor is called back with a
 * `draft` - a mutable proxy of the Store's current `Immutable` `RootState`.
 *
 * You can make changes to the mutable `draft` proxy within your editor callback
 * using any javascript syntax. When it returns,
 * {@link https://immerjs.github.io/immer/ | Immer} efficiently composes a new
 * [[Immutable]] state to reflect your drafted changes, leaving the old state
 * intact. The new state is passed to [[Store.write]].
 *
 * The editor is equivalent to Immer's producer except returning a value doesn't
 * replace the [[RootState]]. To replace the state call [[Store.write]] instead
 * of using an editor. This eliminates Immer's runtime errors when you **draft**
 * changes as well as returning a value, (easily done by accident in simple
 * arrow functions).
 *
 * For careful use in rare cases, Immer's `castDraft` is available in the second
 * editor argument. It can cast parts of previous `Immutable` states to be
 * 'mutable' for assignment to the next `draft` state. Thos items can be added
 * to the draft state, but no changes should actually be made to them.
 *
 * See {@link https://immerjs.github.io/immer/ | Immer docs} for more detail on
 * the conventions for Immer `producers`.
 *
 * @param draft A mutable proxy of a [[Store]]'s existing `Immutable` state,
 * used to compose the next state.
 * @param castDraft Unsafely casts `Immutable` references to mutable to use them
 * in the next draft.
 * */
export type Editor<T> = (draft: Draft<T>) => void;
