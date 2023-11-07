/* eslint-disable @typescript-eslint/ban-types */
import type { Draft } from "immer";

/**  A function passed to {@link edit}. The editor is called back with a
 * `draft` - a mutable proxy of the Store's current `RootState`.
 *
 * You can make changes to the mutable `draft` proxy within your editor callback
 * using any javascript syntax. When it returns,
 * {@link https://immerjs.github.io/immer/ | Immer} efficiently composes a new
 * state to reflect your drafted changes, leaving the old state
 * intact. The new state is passed to {@link @watchable/store.Store#write}.
 *
 * The editor is equivalent to Immer's producer except returning a value doesn't
 * replace the {@link @watchable/store.RootState}. To replace the state call {@link @watchable/store.Store#write} instead
 * of using an editor. This eliminates Immer's runtime errors when you **draft**
 * changes as well as returning a value, (easily done by accident in simple
 * arrow functions).
 *
 * See {@link https://immerjs.github.io/immer/ | Immer docs} for more detail on
 * the conventions for Immer `producers`.
 *
 * @param draft A mutable proxy of a {@link @watchable/store.Store}'s existing state.
 * Manipulate this object to compose the next state.
 * */
export type Editor<T> = (draft: Draft<T>) => void;
