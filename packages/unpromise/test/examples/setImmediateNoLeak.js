// setImmediateNoLeak.js

function resolveValue(value) {
  return new Promise((resolve) => {
    setImmediate(() => resolve(value));
  });
}

async function run() {
  for (;;) {
    await Promise.race([resolveValue("foo"), resolveValue("bar")]);
  }
}

run();
