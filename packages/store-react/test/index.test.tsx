/**
 * @jest-environment jsdom
 */

import React from "react";
import { useRootState, useSelected, useStore } from "../src";
import { render, waitFor, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Immutable, Selector, Store } from "@lauf/store";
import { act } from "react-dom/test-utils";

/** A promise of the next state change in a store. Watchers are notified in
 * order of subscription, so notifications to any previously-subscribed watchers
 * happen before this is resolved. */

/** Wait until after the next write to a Store. */
function nextStateWritten<T extends {}>(store: Store<T>) {
  return new Promise<Immutable<T>>((resolve) => {
    const unwatch = store.watch((state) => {
      resolve(state);
      unwatch();
    });
  });
}

/** Wait for the event loop after the next write to finish (allowing
 * change to propagate). */
async function nextStatePropagated<T extends {}>(store: Store<T>) {
  const state = await nextStateWritten(store); // wait for async operations to be triggered
  await new Promise((resolve) => setTimeout(resolve, 0)); // wait for change to propagate
  return state;
}

/** Complete propagation of a state write within a testing-library `waitFor` guard */
async function promiseWritePropagated<T extends {}>(
  store: Store<T>,
  state: Immutable<T>
) {
  const propagatedPromise = nextStatePropagated(store);
  await act(async () => {
    store.write(state);
    await propagatedPromise;
  });
  return await propagatedPromise;
}

/** IMAGINARY APPLICATION-SPECIFIC DATA, COMPONENTS, SELECTORS */

const planets = ["earth", "mars"] as const;
type Planet = typeof planets[number];
interface State {
  planet: Planet;
  haveAmulet?: boolean;
}

interface StoreProps {
  store: Store<State>;
}

const planetSelector: Selector<State, Planet> = (state) => state.planet;

const PlanetLabel = ({ planet }: { planet: string }) => (
  <p>This is planet {planet}</p>
);

describe("store-react :", () => {
  describe("useRootState behaviour", () => {
    test("Bind with useRootState", async () => {
      const store = createStore<State>({ planet: "earth" });
      const Component = ({ store }: StoreProps) => {
        const { planet } = useRootState(store);
        return <PlanetLabel planet={planet} />;
      };
      render(<Component store={store} />);
      expect(
        await waitFor(() => screen.getByText(/This is planet earth/))
      ).toBeDefined();
      store.write({
        ...store.read(),
        planet: "mars",
      });
      expect(
        await waitFor(() => screen.getByText(/This is planet mars/))
      ).toBeDefined();
    });
  });

  describe("useSelected : (re)render using subset of store", () => {
    /** DEFINE STATE, STORE, UI */

    type Coord = [number, number];
    interface TestState {
      readonly coord: Coord;
    }

    const selectCoord: Selector<TestState, Coord> = (state) => {
      return state.coord;
    };

    describe("Renders when necessary", () => {
      test("Component state follows selector", async () => {
        const Component = (props: { store: Store<TestState> }) => {
          const coord = useSelected(props.store, selectCoord);
          return <div data-testid="component">{JSON.stringify(coord)}</div>;
        };

        const store = createStore<TestState>({
          coord: [0, 0],
        } as const);

        render(<Component store={store} />);

        expect((await screen.findByTestId("component")).textContent).toBe(
          "[0,0]"
        );

        await promiseWritePropagated(store, { coord: [1, 1] } as const);

        expect((await screen.findByTestId("component")).textContent).toBe(
          "[1,1]"
        );
      });

      test("State change between render and useEffect is detected", async () => {
        const selectCoord: Selector<TestState, Coord> = (state) => {
          return state.coord;
        };

        const ComponentWithInlineWrite = (props: {
          store: Store<TestState>;
        }) => {
          const coord = useSelected(props.store, selectCoord);
          // write the value when first rendered
          store.write({
            ...store.read(),
            coord: [3, 4],
          });
          return <div data-testid="component">{JSON.stringify(coord)}</div>;
        };

        const store = createStore<TestState>({
          coord: [0, 0],
        } as const);

        // render caches original value then writes it
        // render schedules a useEffect which will later detect the write
        render(<ComponentWithInlineWrite store={store} />);
        expect((await screen.findByTestId("component")).textContent).toBe(
          "[3,4]"
        );
      }, 120000);
    });

    describe("Renders no more than necessary", () => {
      const renderSpy = jest.fn();

      const StoreSelectionComponent = (props: {
        store: Store<TestState>;
        selector: Selector<TestState, Coord>;
      }) => {
        renderSpy();
        const coord = useSelected(props.store, props.selector);
        return <div data-testid="component">{JSON.stringify(coord)}</div>;
      };

      afterEach(() => renderSpy.mockReset());

      test("Skip render if selected value identical after selector replaced", async () => {
        const store = createStore<TestState>({
          coord: [0, 0],
        } as const);

        // construct a selector
        let selector: Selector<TestState, Coord> = (state) => state.coord;

        // render with the selector
        const { rerender } = render(
          <StoreSelectionComponent store={store} selector={selector} />
        );

        expect(renderSpy).toHaveBeenCalledTimes(1);

        // construct an (identical) selector
        selector = (state) => state.coord;

        // render it again
        rerender(<StoreSelectionComponent store={store} selector={selector} />);

        expect(renderSpy).toHaveBeenCalledTimes(2);
      });

      test("Skip render if selected value identical after store replaced", async () => {
        const selector: Selector<TestState, Coord> = (state) => state.coord;

        // construct a store
        let store = createStore<TestState>({
          coord: [0, 0],
        } as const);

        // render with the selector
        const { rerender } = render(
          <StoreSelectionComponent store={store} selector={selector} />
        );

        expect(renderSpy).toHaveBeenCalledTimes(1);

        // replace with an store having identical coord
        const { coord } = store.read();
        store = createStore<TestState>({
          coord,
        } as const);

        // render it again
        rerender(<StoreSelectionComponent store={store} selector={selector} />);

        expect(renderSpy).toHaveBeenCalledTimes(2);
      });
    });

    test("Render count as expected before and after store writes", async () => {
      const rootRenderSpy = jest.fn();
      const branchRenderSpy = jest.fn();

      const Root = () => {
        rootRenderSpy();
        const store = useStore<State>({ planet: "earth" });
        return <Branch store={store} />;
      };

      const Branch = ({ store }: StoreProps) => {
        branchRenderSpy();
        const planet = useSelected(store, planetSelector);
        return (
          // planet value is rendered
          // amulet value is not rendered
          <>
            <p>This is planet {planet}</p>
            <button
              onClick={() =>
                store.write({
                  ...store.read(),
                  planet: "mars",
                })
              }
            >
              Set Mars
            </button>
            <button
              onClick={() =>
                store.write({
                  ...store.read(),
                  haveAmulet: true,
                })
              }
            >
              Secure Amulet
            </button>
          </>
        );
      };

      // mount component
      const treeToRender = <Root />;
      render(treeToRender);
      expect(rootRenderSpy).toHaveBeenCalledTimes(1); // root rendered
      expect(branchRenderSpy).toHaveBeenCalledTimes(1); // branch rendered

      // write some state rendered in Branch
      rootRenderSpy.mockClear();
      branchRenderSpy.mockClear();
      userEvent.click(screen.getByText("Set Mars"));
      await screen.findByText("This is planet mars");
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(rootRenderSpy).toHaveBeenCalledTimes(0); // root not re-rendered
      expect(branchRenderSpy).toHaveBeenCalledTimes(1); // branch is re-rendered

      // write some state not rendered Anywhere
      rootRenderSpy.mockClear();
      branchRenderSpy.mockClear();
      userEvent.click(screen.getByText("Secure Amulet"));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(rootRenderSpy).toHaveBeenCalledTimes(0); // root not re-rendered
      expect(branchRenderSpy).toHaveBeenCalledTimes(0); // branch not re-rendered
    });
  });
});
