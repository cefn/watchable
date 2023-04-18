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

// create a store
const store = createStore(INITIAL_STATE);

const updateDisplay = ({ counter }) =>
  (counterDisplay.innerText = `Counter is ${counter}`);

// watch for the future
store.watch(updateDisplay);

// display the initial state
updateDisplay(store.read());

incrementButton.onclick = () => {
  increment(store);
};
decrementButton.onclick = () => {
  decrement(store);
};
