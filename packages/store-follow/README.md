## Track selected changes to state

Promise-oriented tracking to monitor selected parts of a @lauf/store {@link Store}.
Re-runs a Selector after each change to store state, and notifies when the
value returned by the Selector changes.

## Usage

### Follow a Selector

```typescript
// given this example store
const gameStore = createStore({
  steps: 0,
  direction: null,
});

// queue any changes to `steps` to be passed to a callback
followSelector(
  gameStore,
  (state) => state.steps,
  async (steps) => {
    stepDisplay.innerText = `Completed ${steps} steps`;
  }
);
```

## Getting Started

### Install

```zsh
npm install @lauf/store-edit
```

## Advanced Usage

### Explicitly handle queue.receive()

For complex examples needing access to underlying queue logic, use
`withSelectorQueue`. It's what `followSelector` uses under the hood.

Sometimes you can't afford the syntactic sugar of `followSelector` which
subscribes your callback automatically and hides the `queue.receive()` API
that is notified of changes to your selection.

Like `followSelector`, `withSelectorQueue` also creates and subscribes a Queue
to be notified every time a new value is returned, but it passes this Queue
direct to your handler along with the initial selected value. It unsubscribes and
disposes the queue only when your handler returns.

#### Example

The `withSelectorQueue` example below needs direct access to `queue.receive()` as it waits for the first event of either...

1. game character direction changed (from users keyboard input)
2. timer expired (the character steps every 300ms)

It therefore has to use `Promise.race()` to handle either the receive or the timeout, whichever comes first.

```typescript
// given this example store
const gameStore = createStore({
  steps: 0,
  direction: null,
});

// track direction (set elsewhere in the app)
const lastDirection = await withSelectorQueue(
  gameStore,
  (state) => state.direction,
  async function ({ receive }, initialDirection) {
    let direction = initialDirection;
    let directionPromise = null;
    let stepPromise = null;
    while (direction !== null) {
      // loop until player stopped moving
      directionPromise = directionPromise || receive();
      stepPromise = stepPromise || sleep(STEP_MS);
      const winner: string = await Promise.race([
        directionPromise.then(() => "direction"),
        stepPromise.then(() => "step"),
      ]);
      if (winner === "direction") {
        direction = await directionPromise; // direction changed
        directionPromise = null; // dispose promise
      } else if (winner === "step") {
        stepDirection(direction); // time to step
        stepPromise = null; // dispose promise
      }
    }
  }
);
```
