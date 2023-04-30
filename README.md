The `@watchable` project includes the following state management and eventing primitives for building interactive web applications...

- Store
  - [@watchable/store](https://cefn.com/watchable/api/modules/_watchable_store.html) - a Store implementation based on Typescript compile-time Immutability
  - [@watchable/store-react](https://cefn.com/watchable/api/modules/_watchable_store_react.html) - React binding of @watchable/store for UI state
  - [@watchable/store-follow](https://cefn.com/watchable/api/modules/_watchable_store_follow.html) - platform-independent binding of @watchable/store, allowing state changes to drive business logic
  - [@watchable/store-edit](https://cefn.com/watchable/api/modules/_watchable_store_edit.html) - edit **draft** @watchable/store states without following [Immutable update patterns](https://redux.js.org/usage/structuring-reducers/immutable-update-patterns) (based on [Immer](https://www.npmjs.com/package/immer))
- Other utilities
  - [@watchable/queue](https://cefn.com/watchable/api/modules/_watchable_queue.html) - an async Queue implementation based on compile-time Immutability
