import { createStore } from "@watchable/store";
import { followSelector } from "@watchable/store-follow";
import { INITIAL_STATE, increment, decrement } from "./logic";

const store = createStore(INITIAL_STATE);

function getDomElement<E extends HTMLElement>(cssSelector: string) {
  const el = document.querySelector<E>(`${cssSelector}`);
  if (el === null) {
    throw new Error(`No element matching '${cssSelector}'`);
  }
  return el;
}

const counterDisplay = getDomElement("#counter");
const incrementButton = getDomElement("#increment");
const decrementButton = getDomElement("#decrement");

void followSelector(
  store,
  (state) => state.counter,
  async (counter) => {
    counterDisplay.innerText = `Counter is ${counter}`;
  }
);

incrementButton.onclick = () => {
  increment(store);
};
decrementButton.onclick = () => {
  decrement(store);
};
