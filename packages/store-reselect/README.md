## Utilities for Memoized Selectors

Subset selectors - selectors that pick a subset of the properties or descendants of a state - need to be carefully memoized. This ensures that so long as the selector's constituents are identical, the exact same object is returned.

Without proper memoization, `Object.is(prev, next)` over consecutive results of a subset selector will always return false as it will create a new object. When using mechanisms that rely on shallow equality checking (such as @watchable/store-react `useSelected()`), downstream values and components will be refreshed unnecessarily.

This package provides convenience factories for suitably-memoized selectors, supported by type-safe path operators. It uses the established [reselect](https://www.npmjs.com/package/reselect) library to meet the necessary guarantees, and the minimal but lodash-path-compatible [just-safe-get](https://www.npmjs.com/package/just-safe-get) package to retrieve descendant paths.

## Usage

### Scenario

```ts
// given the following state type
interface BabyNames {
  grandparent: {
    aunt: {
      cousin: string;
    };
    parent: {
      child: string;
    };
  };
}
```

### emoized selector map

```ts
const { child, aunt } = useMappedSelector(store, {
  child: (state) => state.grandparent.parent.child,
  aunt: (state) => state.grandparent.aunt,
});
```

### Create a memoized path map

This signature offers auto-completion for valid paths of your state object.

```ts
const selected = usePathsSelector(
  store,
  "grandparent",
  "grandparent.parent.child"
);
return (
  <p>
    {selected.grandparent} {selected["grandparent.aunt"]}
  </p>
);
```

## Getting Started

### Install

```zsh
npm install @watchable/store-reselect
```

## Advanced

### Create a store in a component
