import { createStore } from "@lauf/store";
import { followSelector } from "@lauf/store-follow";
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

followSelector(
  store,
  (state) => state.counter,
  async (counter) => {
    counterDisplay.innerText = `Counter is ${counter.toString()}`;
  }
);

incrementButton.onclick = () => increment(store);
decrementButton.onclick = () => decrement(store);
