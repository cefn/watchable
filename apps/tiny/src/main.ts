import { createStore } from "@watchable/store";

const e = document.querySelector("#e") as HTMLElement;

const s = createStore({ w: 0 }, [
  ({ w }) => {
    e.textContent = `${w}`;
  },
]);

e.addEventListener("click", () => {
  s.write({ w: s.read().w + 1 });
});
