import { Unpromise } from "../../src/unpromise";

const INTERRUPT_PROMISE = new Promise((resolve) => {
  process.once("SIGINT", resolve);
});

function promiseValue(value) {
  return new Promise((resolve) => {
    setImmediate(() => resolve(value));
  });
}

async function run() {
  for (;;) {
    await Unpromise.race([INTERRUPT_PROMISE, promiseValue("bar")]);
  }
}

run();
