/* eslint-disable @typescript-eslint/ban-types */

/** Copied under MIT License from
 * https://github.com/immerjs/immer/blob/f6736a4beef727c6e5b41c312ce1b202ad3afb23/src/types/types-external.ts#L51 */

/** Typescript primitive types */
type PrimitiveType = number | string | boolean;

/** Object types that should never be mapped */
type AtomicObject = Function | Promise<any> | Date | RegExp;

/**
 * If the lib "ES2015.Collection" is not included in tsconfig.json,
 * types like ReadonlyArray, WeakMap etc. fall back to `any` (specified nowhere)
 * or `{}` (from the node types), in both cases entering an infinite recursion in
 * pattern matching type mappings
 * This type can be used to cast these types to `void` in these cases.
 */
type IfAvailable<T, Fallback = void> =
  // fallback if any
  true | false extends (T extends never ? true : false)
    ? Fallback // fallback if empty type
    : keyof T extends never
    ? Fallback // original type
    : T;

/**
 * These should also never be mapped but must be tested after regular Map and
 * Set
 */
type WeakReferences =
  | IfAvailable<WeakMap<any, any>>
  | IfAvailable<WeakSet<any>>;

type WritableDraft<T> = { -readonly [K in keyof T]: Draft<T[K]> };

/** Convert a readonly type into a mutable type, if possible */
export type Draft<T> = T extends PrimitiveType
  ? T
  : T extends AtomicObject
  ? T
  : T extends ReadonlyMap<infer K, infer V> // Map extends ReadonlyMap
  ? Map<Draft<K>, Draft<V>>
  : T extends ReadonlySet<infer V> // Set extends ReadonlySet
  ? Set<Draft<V>>
  : T extends WeakReferences
  ? T
  : T extends object
  ? WritableDraft<T>
  : T;

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
export type Immutable<T> = T extends PrimitiveType
  ? T
  : T extends AtomicObject
  ? T
  : T extends ReadonlyMap<infer K, infer V> // Map extends ReadonlyMap
  ? ReadonlyMap<Immutable<K>, Immutable<V>>
  : T extends ReadonlySet<infer V> // Set extends ReadonlySet
  ? ReadonlySet<Immutable<V>>
  : T extends WeakReferences
  ? T
  : T extends object
  ? { readonly [K in keyof T]: Immutable<T[K]> }
  : T;
