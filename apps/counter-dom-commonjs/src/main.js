const { createStore } = require("@lauf/store");
const { followSelector } = require("@lauf/store-follow");
const { INITIAL_STATE, increment, decrement } = require("./logic");

const store = createStore(INITIAL_STATE);

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

followSelector(
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
