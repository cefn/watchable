import { createStore } from "@watchable/store";

// achieves around 32000 renders per second on a chromebook

const { now } = Date;
const t0 = now() - 1;
const e = document.querySelector("#e");
if (e === null) {
  throw new Error("No e#");
}

// store containing render count
const store = createStore({ w: 0 });

// increment render count (trigger render and message)
const inc = () => {
  let { w } = store.read();
  w++;
  store.write({ w });
};

// count incremented - render and message
store.watch(({ w }) => {
  e.textContent = `${Math.floor((w * 1000) / (now() - t0))} writes/s`;
  window.postMessage(null); // notify
});

// notify triggers new iteration
window.addEventListener("message", inc);

// start first iteration
inc();
