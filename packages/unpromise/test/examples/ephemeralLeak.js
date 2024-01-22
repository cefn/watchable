// ephemeralLeak.js

async function promiseValue(value) {
  return value;
}

function immediateExecutor(resolve) {
  setImmediate(resolve);
}

function promiseImmediate() {
  return new Promise(immediateExecutor);
}

async function run() {
  for (;;) {
    await Promise.race([promiseValue("foo"), promiseValue("bar")]);
    await promiseImmediate();
  }
}

run();
