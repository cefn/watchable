## Edit a store's immutable state

An idiot-proof mechanism to write @watchable/store state without breaking immutability. Guarantees safe Immutable edits without needing to learn [Immutable update patterns](https://redux.js.org/usage/structuring-reducers/immutable-update-patterns)

Read the [API Reference](https://cefn.com/watchable/api/modules/_watchable_store_edit.html) or the reference usages below.

## Usage

### Making Edits

```typescript
// given this example store
const counterState = createStore({ counter: 0 });

// editing a draft writes a new immutable state
edit(counterState, (draft) => (draft.counter += 1));
```

## How it works

Your editor function is passed a draft object matching store state. Edit the
draft using any javascript syntax. [Immer](https://www.npmjs.com/package/immer)
then efficiently composes a new Immutable state to reflect your drafted changes,
leaving the old state intact. The new state is passed to `store.write(...)`.

### Import OR Require

```javascript
import { edit } from "@watchable/store-edit"; // for esm
const { edit } = require("@watchable/store-edit"); // for commonjs
```

## Getting Started

### Install

```zsh
npm install @watchable/store-edit
```

### Demonstration Apps

Selected [Example Counter Apps](https://github.com/cefn/watchable/tree/main/apps) offer minimal demonstrations of `@watchable/store-edit`. See the following...

- [counter-react-ts-edit](https://github.com/cefn/watchable/tree/main/apps/counter-react-ts-edit#readme)
- [counter-react-ts-edit-context](https://github.com/cefn/watchable/tree/main/apps/counter-react-ts-edit-context#readme)
