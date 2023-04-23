## Store bindings for React

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

```typescript
// create a store for the lifetime of this component
const store = useStore<CounterState>({ counter: 0, active: false });
```

A Store created through `useStore` can be passed through [prop
drilling](https://kentcdodds.com/blog/prop-drilling) or
[Context](https://github.com/cefn/watchable/tree/main/apps/counter-react-ts-edit-context) to descendant components,
who will subscribe to the parts they want to track.

Note, using the `useStore` hook can often be avoided. A Store can be a
[singleton](https://en.wikipedia.org/wiki/Singleton_pattern) in most apps meaning
a single instance can simply be created and exported from a module.

If you are certain that an ancestor React component will never be replaced and
(hence) lose its state, then `useStore` can be used safely.

If you want different parts of the render tree to have their own independent
copy of some Store, it offers the convenience of components simply creating their own Stores
inline.

### Consume the whole state

```typescript
const rootState = useRootState(props.store);
```

Note, this is rarely needed in production code for several reasons...

- well-architected business logic should live outside the render loop, using `followSelector(...)` from @lauf/store-follow
- to consume **part** of the state, prefer {@link useSelector} which doesn't trigger renders on every state change

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
