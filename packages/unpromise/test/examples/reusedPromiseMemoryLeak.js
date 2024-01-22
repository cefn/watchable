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
    const valuePromise = promiseValue("bar");

    const [winner] = await Promise.race([
      valuePromise.then(() => [valuePromise]),
      INTERRUPT_PROMISE.then(() => [INTERRUPT_PROMISE]),
    ]);

    if (winner === valuePromise) {
      console.log(await valuePromise);
    } else {
      process.exit(2);
    }
  }
}

run();
