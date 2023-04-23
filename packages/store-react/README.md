# @lauf/store-react

Enables React apps to use
[@lauf/store](https://www.npmjs.com/package/@lauf/store) for state-management

## Usage

### Track a part of Store state

```typescript
// given some example store
interface CounterState {
  counter: number;
  active: boolean;
}
const counterStore = createStore<CounterState>({ counter: 0, active: false });

// bind Display to just the `counter` property
// won't re-render when `active` property changes
export const Display = (props: { store: Store<CounterState> }) => {
  const counter = useSelected(props.store, (state) => state.counter);
  return <h1>Counter is {counter}</h1>;
};
```

## Getting Started

### Install

```zsh
npm install @lauf/store-react
```

## Advanced

### Create a store in a component

The store is a singleton in most apps and a store instance can usually be a simple
module export. This means the `useStore` hook can often be avoided. Note, isolating store
creation from component lifecycle eliminates some errors.

However, `useStore` is appropriate in an ancestor component that won't lose its
state. A store created in this way can be passed to its child
components who can subscribe to the parts they want to track...

```typescript
// create a store, to keep for the lifetime of this component
const store = useStore<CounterState>({ counter: 0, active: false });
```

If your store is not a singleton, then consider using the React Context API like [this demo app](../../apps/counter-react-ts-edit-context)

### Consume the whole state

Note, this is rarely needed for several reasons...

- useSelector is preferred as it doesn't render on every state change
- business logic should not happen in the render loop (use @lauf/store-follow instead)

```typescript
// Re-runs this functional component when any state changes
export const StateLog = (props: { store: Store<CounterState> }) => {
  const rootState = useRootState(props.store);
  const [stateHistory, setStateHistory] = useState<CounterState[]>([]);
  useEffect(() => {
    setStateHistory([...stateHistory, rootState]);
  }, [rootState]);
  return <h1>Counter is {counter}</h1>;
};
```
