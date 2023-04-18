import { createStore } from "@lauf/store";
import { INITIAL_STATE, increment, decrement } from "./logic";

function getDomElement(cssSelector) {
  const el = document.querySelector(`${cssSelector}`);
  if (el === null) {
    throw new Error(`No element matching '${cssSelector}'`);
  }
  return el;
}

const counterDisplay = getDomElement("#counter");
const incrementButton = getDomElement("#increment");
const decrementButton = getDomElement("#decrement");

const watchers = [
  ({ counter }) => (counterDisplay.innerText = `Counter is ${counter}`),
];

const store = createStore(INITIAL_STATE, watchers);

incrementButton.onclick = () => {
  increment(store);
};
decrementButton.onclick = () => {
  decrement(store);
};
