import { createSettlementSequence } from "../../src";
import { SkipRetryError } from "../../src/strategies/retry";
import { serializeError } from "../../src/util";

/** We allow 2 outstanding requests to SWAPI at one time. This limits the local
 * resources that would be dedicated to multiple requests in parallel. A
 * nevermore pipeline with a Generator for jobs has a kind of 'backpressure'
 * meaning the creation of new jobs is halted while outstanding requests complete.
 *
 * If SWAPI takes more than 3 seconds to respond, we give up on the request.
 * SWAPI allows 10,000 requests per day (86400000 milliseconds). If we spread
 * this out evenly, we would have to wait 8.64 seconds before each sequential
 * request. Instead we ensure we are below half the overall average, but allow
 * bursts of up to 50 every approximately 14 minutes.
 *
 * If all SWAPI requests from this machine were pipelined through this limiter,
 * it would leave 5000 quota capacity untouched each day for emergency use such
 * as backfilling caches. This helps to avoid a full day-long outage being
 * triggered by some unexpected request load.
 * */

for await (const settlement of createSettlementSequence(
  {
    concurrency: 2,
    timeoutMs: 3000,
    retries: 3,
    intervalMs: 864000,
    intervalSlots: 50,
  },
  function* () {
    // user's generator yields metadata-annotated jobs one by one
    // nevermore lazy-creates, runs them according to regime specified above
    for (const filmId of [0, 1, 2, 3] as const) {
      yield Object.assign(
        async () => {
          const result = await fetch(`https://swapi.dev/api/films/${filmId}/`, {
            method: "get",
            headers: {
              "Content-Type": "application/json",
            },
          });

          const { status } = result;
          if (status === 200) {
            return (await result.json()) as {
              episode_id: number;
              title: string;
              opening_crawl: string;
            };
          }
          const error = new Error(`Status ${status} not OK`);
          if ([429, 500, 502, 503, 507].includes(status)) {
            // throw normal error, (implicitly allows retry)
            throw error;
          }
          // throw special error (wrapping the original error) to prevent retry
          throw new SkipRetryError(`Not retrying status ${status}`, error);
        },
        {
          filmId,
        }
      );
    }
  }
)) {
  // job comes back with type-safe metadata
  const { status, job } = settlement;
  if (status === "fulfilled") {
    // job was a success, consume the result (in the context of the job's metadata)
    const film = settlement.value;
    console.log(`Film ${job.filmId} retrieved`);
    console.log(`Episode ${film.episode_id}`);
    console.log(`Title: '${film.title}'`);
    console.log(film.opening_crawl, "\n\n");
  } else {
    // job failed after three retries
    console.log(`Film ${job.filmId} unsuccessful`);
    console.log(serializeError(settlement.reason), "\n\n");
  }
}
