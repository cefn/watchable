The @lauf project includes the following state management and eventing primitives for building interactive web applications...

- Store
  - [@lauf/store](https://cefn.com/lauf/api/modules/_lauf_store.html) - a Store implementation based on Typescript compile-time Immutability
  - [@lauf/store-react](https://cefn.com/lauf/api/modules/_lauf_store_react.html) - React binding of @lauf/store for UI state
  - [@lauf/store-follow](https://cefn.com/lauf/api/modules/_lauf_store_follow.html) - platform-independent binding of @lauf/store, allowing state changes to drive business logic
  - [@lauf/store-edit](https://cefn.com/lauf/api/modules/_lauf_store_edit.html) - edit **draft** @lauf/store states without following [Immutable update patterns](https://redux.js.org/usage/structuring-reducers/immutable-update-patterns) (based on [Immer](https://www.npmjs.com/package/immer))
- Other utilities
  - [@lauf/queue](https://cefn.com/lauf/api/modules/_lauf_queue.html) - an async Queue implementation based on compile-time Immutability
