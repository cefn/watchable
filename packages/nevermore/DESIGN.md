# Nevermore - Limit-Pipeline Design

Nevermore uses Generators and AsyncGenerators to define behaviour of a pipeline
of async jobs, with the following mechanisms...

## Summary

Nevermore pipelines async results

- Decides when the pipeline has capacity to create and execute the next async
  function from a sequence
- Can execute the async function multiple times in sequence until it succeeds

Limit pipeline primitives are provided for...

- Concurrency
- Rate Limit
- Timeout
- Retry

## Detail

Nevermore iterates over a `createJobSequence` `Iterable` provided by the caller.
It will pull the next async `Job` function (used to create the next async
result) on a just-in-time basis. A `Job` function can be returned multiple
times, or a new function can be created for each result.

Nevermore produces a `ResultSequence` notifying success or failure including a
reference to the originating `Job` for that result.

`Jobs` are simple async functions typed and owned by the caller. `Jobs` can
therefore be annotated in any way. For example `config` could be a property on
`Job`. This helps make sense of failures from any particular async result.

The `Job` generator formalism allows you to respond to unfolding events. You can
add code to notify of job creation or completion. You can dynamically vary job
behaviour (e.g. use a secondary server for all subsequent jobs when one job
experiences a failure of the primary)

# Primitives

Job flow-control primitives have a common signature and a consistent 'chain'
relationship with each other, exchanging flow-control through co-routines.

The nevermore function composes the first primitive from the job-creation
iterable provided by the caller. Nevermore then selectively wires additional job
primitives into the chain according to limit parameters provided. The final
primitive in the chain is wired as an output to notify the caller of successful
and unsuccessful jobs.

Chain primitives facilitate the following...

- lazy job creation and launch

  - each link in the chain consumes a launches iterator from the next chain
  - it calls launches.next() when lazy-creation-and-launch of a job is needed

  - in this way a concurrency primitive can track and limit the count of
    unsettled jobs

# Example behaviours

## Concurrency

The concurrency

Rate limit Retry Timeout
