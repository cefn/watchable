import { createSettlementSequence } from "../../src";

async function run() {
  // define a sequence of zero-arg functions
  async function* createJobSequence() {
    for (;;) {
      yield async () => {
        const result = await fetch(
          `https://timeapi.io/api/TimeZone/zone?timeZone=Europe/London`
        );
        if (result.status !== 200) {
          throw new Error("Failure retrieving time");
        }
        return (await result.json()) as {
          timeZone: string;
          currentLocalTime: string;
        };
      };
    }
  }

  // create a sequence of settlements (limited by specified options)
  const settlementSequence = createSettlementSequence(
    {
      concurrency: 1,
      intervalMs: 1000,
      timeoutMs: 3000,
      retries: 3,
    },
    createJobSequence
  );

  // consume the settlements (like Promise.allSettled())
  for await (const settlement of settlementSequence) {
    if (settlement.status === "fulfilled") {
      console.log(`Time in London is ${settlement.value.currentLocalTime}`);
    } else {
      const { reason } = settlement;
      const message =
        reason instanceof Error ? reason.message : JSON.stringify(reason);
      console.error(`Gave up retrying. Last error was: ${message}`);
    }
  }
}

void run();
