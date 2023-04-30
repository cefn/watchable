/** `Immutable<T>` is used to flag and enforce immutability of a
 * {@link RootState} and its descendants - typically values assigned to a
 * {@link Store} ({@link @watchable/store.Store#write}) or retrieved from it
 * ({@link @watchable/store.Store#read}). This tells the compiler that no
 * modification should be made anywhere in a Store's state tree.
 *
 * Unlike some implementations (such as Object.freeze, Object.seal or
 * {@link https://immutable-js.com/ Immutable.js}) our compile-time Immutability
 * approach introduces no special objects and methods and doesn't require you to
 * change your runtime code at all.
 *
 * Under the hood, `Immutable<T>` is a recursive implementation of Typescript's
 * `Readonly<T>`. Primitive properties are already immutable by definition.
 * Functions are treated as primitive values. All other objects and arrays and
 * their descendants are made `Readonly` recursively until they hit a primitive
 * 'leaf' value.
 *
 * Relying on Typescript's builtin `Readonly` allows the use of normal
 * javascript values and syntax, with the exception that operations which would
 * manipulate the item are disallowed by the compiler. Applications written in
 * Typescript get the greatest benefit from this approach, but javascript IDEs
 * that load typings for code-completion can also indicate violations of the
 * `Readonly` contract.
 *
 */
export type Immutable<T> = T extends (...args: unknown[]) => unknown
  ? T
  : T extends object
  ? ImmutableObject<T>
  : T;

/** Recursive Readonly implementation for any (indexable) {@link RootState} such as
 * an array or object */
export type ImmutableObject<T extends object> = Readonly<{
  [K in keyof T]: Immutable<T[K]>;
}>;
