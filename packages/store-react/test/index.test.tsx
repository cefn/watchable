/**
 * @vitest-environment jsdom
 */

import React, { useEffect, useState } from "react";
import { render, waitFor, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, test, expect, afterEach } from "vitest";

import type { Immutable, Selector, Store, RootState } from "@watchable/store";
import { createStore } from "@watchable/store";

import { useRootState, useSelected, useStateProperty, useStore } from "../src";

/** Wait until after the next write to a Store. */
async function nextStateWritten<T extends RootState>(store: Store<T>) {
  /** A promise of the next state change in a store. Watchers are notified in
   * order of subscription, so notifications to any previously-subscribed watchers
   * happen before this is resolved. */
  return await new Promise<Immutable<T>>((resolve) => {
    const unwatch = store.watch((state) => {
      resolve(state);
      unwatch();
    });
  });
}

/** Adds an event to the javascript VM event loop and (therefore implicitly)
 * waits for all previous _due_ events to have completed. Future events are not
 * awaited (e.g. those on a timeout which haven't yet come due) */
async function eventsDueCompleted() {
  return await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Wait for the event loop after the next write to finish (allowing
 * change to propagate). */
async function nextStatePropagated<T extends RootState>(store: Store<T>) {
  const state = await nextStateWritten(store); // wait for async operations to be triggered
  await eventsDueCompleted(); // wait for change to propagate
  return state;
}

/** Complete propagation of a state write within a testing-library `waitFor` guard */
async function promiseWritePropagated<T extends RootState>(
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
type Planet = (typeof planets)[number];
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
  afterEach(cleanup);

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

  describe("useSelected : ", () => {
    /** DEFINE STATE, STORE, UI */

    type Coord = [number, number];
    interface TestState {
      readonly coord: Coord;
    }

    const selectCoord: Selector<TestState, Immutable<Coord>> = (state) => {
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
        const selectCoord: Selector<TestState, Immutable<Coord>> = (state) => {
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
      const renderSpy = vi.fn();

      const StoreSelectionComponent = (props: {
        store: Store<TestState>;
        selector: Selector<TestState, Immutable<Coord>>;
      }) => {
        renderSpy();
        const coord = useSelected(props.store, props.selector);
        return <div data-testid="component">{JSON.stringify(coord)}</div>;
      };

      afterEach(() => {
        renderSpy.mockReset();
      });

      test("Skip render if selected value identical after selector replaced", async () => {
        const store = createStore<TestState>({
          coord: [0, 0],
        } as const);

        // construct a selector
        let selector: Selector<TestState, Immutable<Coord>> = (state) =>
          state.coord;

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
        const selector: Selector<TestState, Immutable<Coord>> = (state) =>
          state.coord;

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
      const rootRenderSpy = vi.fn();
      const branchRenderSpy = vi.fn();

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
      await userEvent.click(screen.getByText("Set Mars"));
      await screen.findByText("This is planet mars");
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(rootRenderSpy).toHaveBeenCalledTimes(0); // root not re-rendered
      expect(branchRenderSpy).toHaveBeenCalledTimes(1); // branch is re-rendered

      // write some state not rendered Anywhere
      rootRenderSpy.mockClear();
      branchRenderSpy.mockClear();
      await userEvent.click(screen.getByText("Secure Amulet"));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(rootRenderSpy).toHaveBeenCalledTimes(0); // root not re-rendered
      expect(branchRenderSpy).toHaveBeenCalledTimes(0); // branch not re-rendered
    });
  });

  describe("useStateProperty : ", () => {
    test("renders the property", () => {
      const renderSpy = vi.fn();
      const store = createStore({ roses: "red" });
      const Component = () => {
        renderSpy();
        const [roseColor, _setRoseColor] = useStateProperty(store, "roses");
        return <p>{roseColor}</p>;
      };
      render(<Component />);
      // property was rendered
      screen.getByText("red");
      // render should have been triggered once
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    test("re-renders when property changes", async () => {
      const renderSpy = vi.fn();
      const store = createStore({ roses: "red" });
      const Component = () => {
        renderSpy();
        const [roseColor, _setRoseColor] = useStateProperty(store, "roses");
        return <p>{roseColor}</p>;
      };
      render(<Component />);
      screen.getByText("red");
      renderSpy.mockClear();
      // write a change and wait for all listeners to be notified
      await promiseWritePropagated(store, { roses: "white" });
      // expect the component to have changed
      screen.getByText("white");
      // render should have been triggered once
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    test("re-renders when key changes", async () => {
      const renderSpy = vi.fn();
      const initialState = { roses: "red", violets: "blue" };
      const store = createStore(initialState);
      // render a component that renders once then
      // changes the key it is watching in the state
      const Component = () => {
        renderSpy();
        const [renderedKey, setRenderedKey] =
          useState<keyof typeof initialState>("roses");
        const [value, _setter] = useStateProperty(store, renderedKey);
        useEffect(() => {
          void (async () => {
            await Promise.resolve();
            setRenderedKey("violets");
          })();
        }, []);
        return <p>{value}</p>;
      };
      render(<Component />);
      screen.getByText("red");
      expect(renderSpy).toHaveBeenCalledTimes(1);
      renderSpy.mockClear();
      await eventsDueCompleted(); // await for useEffect to set Rendered Key
      await eventsDueCompleted(); // await for consequent render
      // expect the component to render the different keyed property
      screen.getByText("blue");
      // render will have been triggered twice more
      // once after useEffect changed key (passed to the useStateProperty call)
      // once more for the useSelected inside useStateProperty to propagate its internal state
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    test("ignores untracked property of store", async () => {
      const renderSpy = vi.fn();
      const store = createStore({ roses: "red", violets: "blue" });
      const Component = () => {
        renderSpy();
        const [roseColor, _setRoseColor] = useStateProperty(store, "roses");
        return <p>{roseColor}</p>;
      };
      render(<Component />);
      screen.getByText("red");
      // write the untracked property
      renderSpy.mockClear();
      await promiseWritePropagated(store, {
        ...store.read(),
        violets: "yellow",
      });
      screen.getByText("red");
      // render shouldn't have been triggered again
      expect(renderSpy).toHaveBeenCalledTimes(0);
    });

    test("setter changes property", async () => {
      const renderSpy = vi.fn();
      const store = createStore({ roses: "red" });
      const Component = () => {
        renderSpy();
        const [roseColor, setRoseColor] = useStateProperty(store, "roses");
        useEffect(() => {
          setRoseColor("white");
        }, []);
        return <p>{roseColor}</p>;
      };

      // promise to detect setter being called
      const writtenPromise = nextStateWritten(store);
      // renders initial value (setter is called in useEffect after render)
      render(<Component />);
      screen.getByText("red");
      expect(renderSpy).toHaveBeenCalledTimes(1);
      renderSpy.mockClear();
      // wait for setter to be called
      await writtenPromise;
      screen.getByText("white");
      await eventsDueCompleted();
      // render should have been triggered just once more
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });
});
