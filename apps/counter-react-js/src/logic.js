export const INITIAL_STATE = {
  counter: 0,
};

export function increment(store) {
  const { counter } = store.read();
  store.write({
    counter: counter + 1,
  });
}

export function decrement(store) {
  const { counter } = store.read();
  store.write({
    counter: counter - 1,
  });
}
