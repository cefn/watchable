const INITIAL_STATE = {
  counter: 0,
};

function increment(store) {
  const state = store.read();
  const { counter } = state;
  store.write({
    ...state,
    counter: counter + 1,
  });
}

function decrement(store) {
  const state = store.read();
  const { counter } = state;
  store.write({
    ...state,
    counter: counter - 1,
  });
}

module.exports = {
  INITIAL_STATE,
  increment,
  decrement,
};
