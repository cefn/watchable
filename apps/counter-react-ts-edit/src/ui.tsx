import React from "react";
import type { Store } from "@lauf/store";
import { useSelected, useStore } from "@lauf/store-react";
import type { CounterState } from "./logic";
import { INITIAL_STATE } from "./logic";
import { edit } from "@lauf/store-edit";

interface StoreProps {
  store: Store<CounterState>;
}

export const Display = ({ store }: StoreProps) => {
  const counter = useSelected(store, (state) => state.counter);
  return <h1>Counter is {counter}</h1>;
};

export const IncreaseButton = ({ store }: StoreProps) => (
  <button
    onClick={() => {
      edit(store, (draft) => {
        draft.counter += 1;
      });
    }}
  >
    Increase
  </button>
);

export const DecreaseButton = ({ store }: StoreProps) => (
  <button
    onClick={() => {
      edit(store, (draft) => {
        draft.counter -= 1;
      });
    }}
  >
    Decrease
  </button>
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
