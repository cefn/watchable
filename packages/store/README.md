# A minimal pattern for watchable state

[513 gzipped bytes](https://bundlephobia.com/package/@watchable/store) of powerful state-management!

A [Store](https://watchable.dev/api/interfaces/_watchable_store.Store.html) maintains a protected reference to an array or object `state` that is treated as immutable. When a new state is passed to {@link Store#write | store.write()}, user interfaces and business logic are notified of changes to state matching their {@link Selector | Selectors}.

@watchable/store is incredibly simple, lightweight and framework-independent, and therefore suited to manage state within almost any server-side or client-side Typescript or Javascript project.

Read the [API Reference](https://watchable.dev/api/modules/_watchable_store.html), examine the example code below, or [browse the source on Github](https://github.com/cefn/watchable/tree/main/packages/store). There is also a [Medium article describing the approach](https://medium.com/codex/dumping-redux-wasnt-so-hard-578a0e0bf946)

# Usage

## Create a Store - Javascript

```javascript
const store = createStore({ counter: 0 });
```

## Create a Store - Typescript

```typescript
import { createStore, type Immutable} from "@watchable/store"

// `Immutable` blocks inadvertent state edits - recommended but optional.
type CounterState = Immutable<{
  counter: number;
}>

const INITIAL_STATE : CounterState = {
  counter: 0,
} as const;

const store = createStore(INITIAL_STATE);
```

## Read and Write State

```typescript
// read state
const state = store.read();

// write state using immutable patterns
store.write({
  ...state,
  counter: state.counter + 1,
});

// create the next immutable state by
// editing a draft (backed by Immer)
import { edit } from "@watchable/store-edit";
edit(store, (draft) => (draft.counter += 1));
```

## Track State

```typescript
/* REACT-BASED */

// using selector and memoized Hook (React framework)
// re-renders after the selected value changes
import { useSelected } from "@watchable/store-react";
const counter = useSelected(store, (state) => state.counter);

// get and set keyed property, (like React useState), with intellisense for valid keys 
const [counter, setCounter] = useStateProperty(store, "counter");

/* FRAMEWORK AGNOSTIC */

// using a watcher
store.watch((state) => console.log(`Counter is ${state.counter}`));

// using selector and memoized callback (Framework independent)
// invoked each time the selected value changes
import { followSelector } from "@watchable/store-follow";
followSelector(
  store,
  (state) => state.counter,
  (counter) => {
    console.log(`Counter is ${counter}`);
  }
);

```

## Import OR Require

```javascript
import { createStore } from "@watchable/store"; // gets esm build
const { createStore } = require("@watchable/store"); // gets commonjs build
```

# Getting Started

## Install

```zsh
npm install @watchable/store
```

## Demonstration Apps

The Example Counter [Apps](https://github.com/cefn/watchable/tree/main/apps#readme) offer minimal demonstrations of `@watchable/store`

- Counter Apps using various **_Web Frameworks_**:
  - [with React](https://github.com/cefn/watchable/tree/main/apps/counter-react-ts) (using [@watchable/store-react](https://github.com/cefn/watchable/tree/main/packages/store-react#readme))
  - [with no framework](https://github.com/cefn/watchable/tree/main/apps/counter-dom-ts#readme) (using [@watchable/store-follow](https://github.com/cefn/watchable/tree/main/packages/store-follow#readme))
  - [with Preact](https://github.com/cefn/watchable/tree/main/apps/counter-preact-ts#readme) (using [@watchable/store-react](https://github.com/cefn/watchable/tree/main/packages/store-react#readme)) and aliased React
- Counter Apps using various **_Bundling approaches_**:
  - [via Commonjs](https://github.com/cefn/watchable/tree/main/apps/counter-dom-commonjs#readme)
  - [via ESM](https://github.com/cefn/watchable/tree/main/apps/counter-dom-esm#readme)
  - [for tiniest bundle](https://github.com/cefn/watchable/tree/main/apps/counter-dom-tiny#readme) (a tree-shaken counter app in just 406 bytes!)
- Counter Apps demonstrating **_Tips and Tricks_**:
  - Manage Immutability using [editable drafts](https://github.com/cefn/watchable/tree/main/apps/counter-react-ts-edit#readme) - eliminates [Immutable update patterns](https://redux.js.org/usage/structuring-reducers/immutable-update-patterns)
  - Share a store with multiple components using [React Context API](https://github.com/cefn/watchable/tree/main/apps/counter-react-ts-edit-context#readme) - eliminates [prop drilling](https://kentcdodds.com/blog/prop-drilling)
  - The [fastest possible](https://github.com/cefn/watchable/tree/main/apps/fast) app using @watchable/store (32000 updates per second)
  - The [smallest possible](https://github.com/cefn/watchable/tree/main/apps/tiny) app using @watchable/store-react (316 bytes)
