import React from "react";
import { useSelected, useStore } from "@lauf/store-react";
import { decrement, increment, INITIAL_STATE } from "./logic";
import { CounterRoot, useCounterStore } from "./context";

export const Display = () => {
  const counterStore = useCounterStore();
  const counter = useSelected(counterStore, (state) => state.counter);
  return <h1>Counter is {counter}</h1>;
};

export const IncreaseButton = () => {
  const counterStore = useCounterStore();
  return (
    <button
      onClick={() => {
        increment(counterStore);
      }}
    >
      Increase
    </button>
  );
};

export const DecreaseButton = () => {
  const counterStore = useCounterStore();
  return (
    <button
      onClick={() => {
        decrement(counterStore);
      }}
    >
      Increase
    </button>
  );
};

export const App = () => {
  const store = useStore(INITIAL_STATE);
  return (
    <CounterRoot store={store}>
      <Display />
      <IncreaseButton />
      <DecreaseButton />
    </CounterRoot>
  );
};
