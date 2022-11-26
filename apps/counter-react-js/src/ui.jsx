import React from "react";
import { useSelected, useStore } from "@lauf/store-react";
import { INITIAL_STATE, decrement, increment } from "./logic";

export const Display = ({ store }) => {
  const counter = useSelected(store, (state) => state.counter);
  return <h1>{counter}</h1>;
};

export const IncreaseButton = ({ store }) => (
  <button onClick={() => increment(store)}>Increase</button>
);

export const DecreaseButton = ({ store }) => (
  <button onClick={() => decrement(store)}>Decrease</button>
);

export const App = () => {
  const store = useStore(INITIAL_STATE);
  return (
    <>
      <Display store={store} />
      <IncreaseButton store={store} />
      <DecreaseButton store={store} />
    </>
  );
};
