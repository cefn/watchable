## Minimal in-memory message queue

A Typescript queue implementation with...

- a Promise-oriented, Generic API to build your own event loops
- queue limits to facilitate [backpressure](https://medium.com/@jayphelps/backpressure-explained-the-flow-of-data-through-software-2350b3e77ce7)
- immutable queue state to facilitate [time-travel debugging](https://medium.com/replay-io/introduction-to-time-travel-debugging-a02786c5c0d9)

Read the [API Reference](https://watchable.dev/api/modules/_watchable_queue.html) or the reference usages below, or [browse the source on Github](https://github.com/cefn/watchable/tree/main/packages/queue).

## Usage

```typescript
// Create a queue that accepts any values
const queue = createQueue();

// put an event in the queue
queue.send({
  kind: "move",
  x: 200,
  y: 200,
});

// block until next event is available
const action = await queue.receive();
```

```typescript
// define an event type
interface Coordinate {
  x: number;
  y: number;
}

// Create a queue for typed events
const typedQueue = createQueue<Coordinate>();

// block until next event is available
const { x, y } = await queue.receive();
```

### Import OR Require

```javascript
import { createQueue } from "@watchable/queue"; // for esm
const { createQueue } = require("@watchable/queue"); // for commonjs
```

## Getting Started

### Install

```zsh
npm install @watchable/queue
```
