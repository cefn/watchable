import { createStore } from "@lauf/store";
import { edit } from "../src/edit";

test("Editing replaces only ancestor objects containing a change", () => {
  const store = createStore({
    ancient: ["Roses are red", "Violets are blue"],
    modern: ["Sugar is sweet", "So are you"],
  });
  const stateBefore = store.read();
  edit(store, (draft) => {
    draft.ancient[0] = "Roses are white";
  });
  const stateAfter = store.read();
  expect(Object.is(stateBefore, stateAfter)).toBe(false);
  expect(
    [
      stateBefore.ancient,
      stateAfter.ancient,
      stateBefore.ancient,
      stateAfter.ancient,
    ].every((item) => Array.isArray(item))
  ).toBe(true);
  expect(Object.is(stateBefore.ancient, stateAfter.ancient)).toBe(false);
  expect(Object.is(stateBefore.modern, stateAfter.modern)).toBe(true);
});
