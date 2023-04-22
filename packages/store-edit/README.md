# @lauf/store-edit

An idiot-proof mechanism to write @lauf/store state. Guarantees safe Immutable edits without needing to learn [Immutable update patterns](https://redux.js.org/usage/structuring-reducers/immutable-update-patterns)

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
import { edit } from "@lauf/store-edit"; // for esm
const { edit } = require("@lauf/store-edit"); // for commonjs
```

## Getting Started

### Install

```zsh
npm install @lauf/store-edit
```

### Demonstration Apps

Selected [Example Counter Apps](../../apps) offer minimal demonstrations of `@lauf/store-edit`. See the following...

- [counter-react-ts-edit](../../apps/counter-react-ts-edit)
- [counter-react-ts-edit-context](../../apps/counter-react-ts-edit-context)
