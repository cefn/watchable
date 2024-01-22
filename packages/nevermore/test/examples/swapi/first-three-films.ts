import { nevermore, serializeError } from "../../../src";

export async function fetchOk(url: string) {
  const result = await fetch(url, {
    method: "get",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (result.status === 200) {
    return await result.json();
  }
  throw new Error(`Status ${result.status} not OK`);
}

export function createFilmJob(filmId: number) {
  return Object.assign(
    async () =>
      (await fetchOk(`https://swapi.dev/api/films/${filmId}/`)) as {
        episode_id: number;
        title: string;
        opening_crawl: string;
      },
    {
      filmId,
    }
  );
}

/** We allow 2 outstanding requests to SWAPI at one time. This limits the local
 * resources that would be dedicated to multiple requests in parallel. Hitting
 * the concurrency limit applies a backpressure meaning the creation of new jobs
 * is halted while outstanding requests complete.
 *
 * If SWAPI takes more than 3 seconds to respond, we give up on the request.
 * SWAPI allows 10,000 requests per day (86400000 milliseconds). If we spread
 * this out evenly, we would have to wait 8.64 seconds before each sequential
 * request. Instead we ensure we are below half the overall average, but allow
 * bursts of up to 50 every approximately 14 minutes.
 *
 * If all SWAPI requests from one IP were pipelined through this limiter,
 * it would leave 5000 quota capacity untouched each day for emergency use such
 * as backfilling caches. This would help to avoid a full day-long outage being
 * triggered by some unexpected request load.
 * */
const settlementSequence = nevermore(
  {
    concurrency: 2,
    timeoutMs: 3000,
    intervalMs: 864000,
    intervalSlots: 50,
  },
  function* () {
    for (const filmId of [0, 1, 2, 3] as const) {
      yield createFilmJob(filmId);
    }
  }
);

for await (const settlement of settlementSequence) {
  const { status, job } = settlement;
  if (status === "fulfilled") {
    const film = settlement.value;
    console.log(`Film ${job.filmId} retrieved`);
    console.log(`Episode ${film.episode_id}`);
    console.log(`Title: '${film.title}'`);
    console.log(film.opening_crawl, "\n\n");
  } else {
    console.log(`Film ${job.filmId} unsuccessful`);
    console.log(serializeError(settlement.reason), "\n\n");
  }
}
