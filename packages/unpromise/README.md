# Alias any Promise to an Unpromise that supports unsubscription

The built-in implementation of Promise.race and Promise.any have a bug/feature
that leads to uncontrollable memory leaks.

For example in this example app, we

```

```

# Usage

## Create an Unpromise

## Create a SubscribedPromise

## Unsubscribe to mitigate for Memory Leaks

## Import OR Require

```javascript
import { Unpromise } from "@watchable/unpromise"; // gets esm build
const { Unpromise } = require("@watchable/unpromise"); // gets commonjs build
```

# Getting Started

## Install

```zsh
npm install @watchable/unpromise
```

## Example Apps
