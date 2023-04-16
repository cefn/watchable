export const INITIAL_STATE = {
  counter: 0,
};

export function increment(store) {
  const state = store.read();
  store.write({
    ...state,
    counter: state.counter + 1,
  });
}

export function decrement(store) {
  const state = store.read();
  store.write({
    ...state,
    counter: state.counter - 1,
  });
}
