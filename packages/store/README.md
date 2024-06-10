# Minimal watchable state for your app

## Install

```zsh
npm install @watchable/store

# for optional features
npm install @watchable/store-react # React binding
npm install @watchable/store-follow # Business-logic binding
npm install @watchable/store-edit # Immer drafts
```

## Summary

A `@watchable/store`
[Store](https://watchable.dev/api/interfaces/_watchable_store.Store.html)
maintains a immutably-typed reference to an (array or object) `state` with
intuitive utilities for wiring up ui components and business logic.

See the
[Medium article](https://medium.com/codex/dumping-redux-wasnt-so-hard-578a0e0bf946)

## Import OR Require

```javascript
import { createStore } from "@watchable/store"; // esm
const { createStore } = require("@watchable/store"); //commonjs
```

## Create a Store (Javascript)

```javascript
const store = createStore({ counter: 0 });
```

See below for runtime Immutable state in Typescript!

## Track State

In React...

```typescript
import { useSelected } from "@watchable/store-react";
const counter = useSelected(store, (state) => state.counter);

// get and set keyed property, like React useState
const [counter, setCounter] = useStateProperty(store, "counter");
```

In pure business logic...

```typescript
// watching the store
store.watch((state) => console.log(`Counter is ${state.counter}`));

// follow a selector (called back any time the selected value changes)
import { followSelector } from "@watchable/store-follow";
followSelector(
  store,
  (state) => state.counter,
  (counter) => {
    console.log(`Counter is ${counter}`);
  }
);
```

## Read and Write State

Using a draft...

```typescript
// create the next immutable state by editing a draft
import { edit } from "@watchable/store-edit";
edit(store, (draft) => (draft.counter += 1));
```

Using pure immutable patterns...

```typescript
// read state
const state = store.read();

// write state using immutable patterns
store.write({
  ...state,
  counter: state.counter + 1,
});
```

## Create an Immutable Store (Typescript)

```typescript
import { createStore, type Immutable } from "@watchable/store";

// `Immutable` is recommended to block inadvertent edits of state
type CounterState = Immutable<{
  counter: number;
}>;

const INITIAL_STATE: CounterState = {
  counter: 0,
} as const;

const store = createStore(INITIAL_STATE);
```

# Description

[472 gzipped bytes](https://bundlephobia.com/package/@watchable/store) of
powerful state-management!

When a new state is passed to
[store.write()](https://watchable.dev/api/interfaces/_watchable_store.Store.html#write),
user interfaces and business logic are notified of changes to state matching
their
[Selectors](https://watchable.dev/api/types/_watchable_store.Selector.html).

@watchable/store is incredibly simple, lightweight and framework-independent,
and therefore suited to manage state within almost any server-side or
client-side Typescript or Javascript project.

Read the
[API Reference](https://watchable.dev/api/modules/_watchable_store.html),
examine the example code below, or
[browse the source on Github](https://github.com/cefn/watchable/tree/main/packages/store).

## Demonstration Apps

The Example Counter
[Apps](https://github.com/cefn/watchable/tree/main/apps#readme) offer minimal
demonstrations of `@watchable/store`

- Counter Apps using various **_Web Frameworks_**:
  - [with React](https://github.com/cefn/watchable/tree/main/apps/counter-react-ts)
    (using
    [@watchable/store-react](https://github.com/cefn/watchable/tree/main/packages/store-react#readme))
  - [with no framework](https://github.com/cefn/watchable/tree/main/apps/counter-dom-ts#readme)
    (using
    [@watchable/store-follow](https://github.com/cefn/watchable/tree/main/packages/store-follow#readme))
  - [with Preact](https://github.com/cefn/watchable/tree/main/apps/counter-preact-ts#readme)
    (using
    [@watchable/store-react](https://github.com/cefn/watchable/tree/main/packages/store-react#readme))
    and aliased React
- Counter Apps using various **_Bundling approaches_**:
  - [via Commonjs](https://github.com/cefn/watchable/tree/main/apps/counter-dom-commonjs#readme)
  - [via ESM](https://github.com/cefn/watchable/tree/main/apps/counter-dom-esm#readme)
  - [for tiniest bundle](https://github.com/cefn/watchable/tree/main/apps/counter-dom-tiny#readme)
    (a tree-shaken counter app in just 406 bytes!)
- Counter Apps demonstrating **_Tips and Tricks_**:
  - Manage Immutability using
    [editable drafts](https://github.com/cefn/watchable/tree/main/apps/counter-react-ts-edit#readme) -
    eliminates
    [Immutable update patterns](https://redux.js.org/usage/structuring-reducers/immutable-update-patterns)
  - Share a store with multiple components using
    [React Context API](https://github.com/cefn/watchable/tree/main/apps/counter-react-ts-edit-context#readme) -
    eliminates [prop drilling](https://kentcdodds.com/blog/prop-drilling)
  - The
    [fastest possible](https://github.com/cefn/watchable/tree/main/apps/fast)
    app using @watchable/store (32000 updates per second)
  - The
    [smallest possible](https://github.com/cefn/watchable/tree/main/apps/tiny)
    app using @watchable/store-react (316 bytes)
