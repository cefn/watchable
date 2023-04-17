export const INITIAL_STATE = {
  counter: 0,
};

export function increment(store) {
  const state = store.read();
  const { counter } = state;
  store.write({
    ...state,
    counter: counter + 1,
  });
}

export function decrement(store) {
  const state = store.read();
  const { counter } = state;
  store.write({
    ...state,
    counter: counter - 1,
  });
}
