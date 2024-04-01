# Fix horizontal layout

Currently there's an implicit bug in which the promised value is only set once,
because the sequence is not as originally imagined...

```
promised, executed, rejected
promised, executed, rejected
promised, executed, fulfilled
```

It is in fact more like this, because there is only a single original promise...

```
promised, executed, rejected
executed, rejected
executed, fulfilled
```

The consequence of this is that the creation of a new timing object assumed by
receiving the `promised` event never actually happens, so future events simply
overwrite one single event.

# Create bar graph

A histogram would be valuable to display...

- unsettled promises
- unsettled executions

It would help to illustrate the difference between the wrapped-function and the
task-generator API.

# Add axes, labels and color key

Having axes illustrating the milliseconds and labels on each row would assist
interpreting the diagrams when screenshotted for e.g. a Medium article
