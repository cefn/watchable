## Framework-independent, writable, trackable store

**490 gzipped bytes** of powerful state-management!

Read the [API Reference](https://watchable.dev/api/modules/_watchable_store.html) or the reference usages below, or [browse the source on Github](https://github.com/cefn/watchable/tree/main/packages/store).

A [Store](https://watchable.dev/api/interfaces/_watchable_store.Store.html) maintains a protected reference to an Immutable array or object `state`. It brokers all changes to `state`, enabling app interfaces and business logic to track modifications through Selectors.

It is incredibly simple, lightweight and framework-independent, and therefore suited to manage state within almost any server-side or client-side Typescript or Javascript project.

## Usage

### Track State

```typescript
// using a watcher
store.watch((state) => console.dir(state));

// using a selector and a memoizing React Hook
import { useSelected } from "@watchable/store-react";
const counter = useSelected(store, (state) => state.counter);

// using a selector and a memoizing event queue (framework independent)
import { followSelector } from "@watchable/store-follow";
followSelector(
  store,
  (state) => state.counter,
  (counter, { exit }) => {
    console.log(`Counter is ${counter}`);
    if (counter > 10) return exit(counter);
  }
);
```

### Read and Write State

```typescript
// read state
const state = store.read();

// write state using immutable patterns
store.write({
  ...state,
  counter: state.counter + 1,
});

// write state using drafted state object
import { edit } from "@watchable/store-edit";
edit(store, (draft) => (draft.counter += 1));
```

### Import OR Require

```javascript
import { createStore } from "@watchable/store"; // for esm
const { createStore } = require("@watchable/store"); // for commonjs
```

### Create a Store in Javascript

```javascript
const store = createStore({ counter: 0 });
```

### Create a Store In Typescript

```typescript
interface CounterState {
  counter: number;
}

const INITIAL_STATE = {
  counter: 0,
} as const;

const store = createStore<CounterState>(INITIAL_STATE);
```

## Getting Started

### Install

```zsh
npm install @watchable/store
```

### Demonstration Apps

Our Example Counter [Apps](https://github.com/cefn/watchable/tree/main/apps#readme) offer minimal demonstrations of `@watchable/store`

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
