# @lauf/store-follow

Promise-oriented tracking to monitor selected parts of a @lauf/store [[Store]].
Re-runs a Selector after each change to store state, and notifies when the
value returned by the Selector changes.

## Usage

### Follow a Selector

```typescript
// given this example store
const gameStore = createStore({ steps: 0, direction: null });

// queue any changes to `steps` to be passed to a callback
followSelector(
  gameStore,
  (state) => state.steps,
  async (steps) => {
    stepDisplay.innerText = `Comleted ${steps} steps`;
  }
);
```

### Explicitly handle queue.receive()

For complex examples needing access to underlying queue logic, use
`withSelectorQueue`. Its what `followSelector` uses under the hood.

Sometimes you can't afford the syntactic sugar of `followSelector` which
subscribes your callback automatically and hides the `queue.receive()` API
that is notified of changes to your selection.

Like `followSelector`, `withSelectorQueue` also creates and subscribes a Queue
to be notified every time a new value is returned, but it passes this Queue
direct to your handler along with the initial selected value. It unsubscribes and
disposes the queue when your handler returns.

#### Example

The `withSelectorQueue` example below waits for the first event of either

1. a change of the game character's direction (from users keyboard input)
2. an expired timer (the character should step in the current direction every 300ms)

It has to use `Promise.race()` to handle either the receive or the timeout, whichever comes first.

```typescript
// track direction (set elsewhere in the app)
const lastDirection = await withSelectorQueue(
  gameStore,
  (state) => state.direction,
  async function ({ receive }, initialDirection) {
    let direction = initialDirection;
    while (direction !== null) {
      directionPromise = directionPromise || receive();
      expiryPromise = expiryPromise || promiseExpiry(STEP_MS);
      const winner: string = await Promise.race([
        directionPromise.then(() => "motionChanged"),
        expiryPromise.then(() => "stepDue"),
      ]);
      if (winner === "motionChanged") {
        direction = await directionPromise; // direction changed
        motionPromise = null; // dispose promise
      } else if (winner === "stepDue") {
        moveDirection(direction); // time to move
        expiryPromise = null; // dispose promise
      }
    }
  }
);
```
