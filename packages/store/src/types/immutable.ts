/** Recursive implementation of Typescript's `Readonly<T>`.
 *
 * Unlike some implementations of immutability this approach introduces no
 * special objects and methods and typically doesn't require you to change your
 * code.
 *
 * It is used to flag and enforce immutability of a {@link RootState} and its
 * descendants - values assigned to a {@link Store} ([[Store.write]]) or retrieved
 * from it ([[Store.read]]). The type `Immutable<T>` is equivalent to applying
 * `Readonly<T>` to `T` and its descendant properties, telling the compiler that
 * no change should be made anywhere in a Store's state tree.
 *
 * Relying on Typescript's builtin `Readonly` allows the use of normal
 * javascript values and syntax, with the exception that operations which would
 * manipulate the item are disallowed by the compiler. Applications written in
 * Typescript get the greatest benefit from this approach, but javascript IDEs
 * that load typings for code-completion can also indicate violations of the
 * `Readonly` contract.
 *
 * Primitive properties are already immutable by definition. Functions are
 * treated as primitive values. All other objects and arrays have their children
 * made `Readonly` recursively.
 *
 */
export type Immutable<T> = T extends (...args: unknown[]) => unknown
  ? T
  : T extends object
  ? ImmutableIndex<T>
  : T;

/** Recursive Readonly implementation for any (indexable) {@link RootState} such as
 * an array or object */
type ImmutableIndex<T> = Readonly<{
  [K in keyof T]: Immutable<T[K]>;
}>;
