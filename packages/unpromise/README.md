# Unpromise: A Proxy Promise supporting unsubscription

The built-in implementation of
[Promise.race](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race)
and
[Promise.any](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any)
have a bug/feature that leads to uncontrollable memory leaks.

For example in the example app below, we have a long-lived Promise that we await
every time around the loop with `Promise.race(...)`. We use `race` so that we
can respond to _**either**_ the task result _**or**_ the keyboard interrupt.

Unfortunately this leads to a memory leak because every `Promise.race` creates
an unbreakable reference chain from the interruptPromise to the taskPromise and
its task result, and these references can never be garbage-collected.

```js
const interruptPromise = new Promise((resolve) => {
  process.once("SIGINT", () => resolve("interrupted"));
});

async function run() {
  let count = 0;
  for (; ; count++) {
    const taskPromise = new Promise((resolve) => {
      // an imaginary task
      setImmediate(() => resolve("task_result"));
    });
    const result = await Promise.race([taskPromise, interruptPromise]);
    if (result === "interrupted") {
      break;
    }
    console.log(`Completed ${count} tasks`);
  }
  console.log(`Interrupted by user`);
}

run();
```

## Install

```zsh
npm install @watchable/unpromise
```

## Import OR Require

```javascript
import { Unpromise } from "@watchable/unpromise"; // esm build
const { Unpromise } = require("@watchable/unpromise"); // commonjs build
```

# Usage

The simplest usage is probably to use `Unpromise.race` or `Unpromise.any` in the
place of `Promise.race` and `Promise.any`.

```ts
const raceResult = await Unpromise.race([taskPromise, interruptPromise]);
const anyResult = await Unpromise.any([taskPromise, interruptPromise]);
```

Advanced users who want to exploit `SubscribablePromise` for their own
async/await patterns should consider `Unpromise.proxy()` or
`Unpromise.resolve()`. Read more at the [API docs].

## Create an Unpromise

The library manages a single lazy-created, cached `ProxyPromise` that shadows
any `Promise`. For every native Promise there is only one `ProxyPromise`. It
remains cached for the lifetime of the Promise itself.

```ts
const unpromise = Unpromise.proxy(promise);
```

## Create a SubscribedPromise

Once you have a `ProxyPromise` you can call `.then()` `.catch()` `.finally()` in
the normal way. The resulting promise is a `SubscribedPromise` that behaves like
any normal `Promise` except it has an `unsubscribe()` method that will remove
its handlers from the `ProxyPromise` hence eliminating memory leaks. If you use
`Unpromise.race` or `Unpromise.any`, proxying and subscribing each `Promise` is
all handled for you automatically.

## Unsubscribe to mitigate for Memory Leaks

# Getting Started

## Example Apps
