import { promises } from "fs";
import { Unpromise } from "../../../src";
import { sleep } from "../../util";
const { readdir } = promises;

/** Stays unsettled until SIGINT or SIGTERM */
const terminationPromise = new Promise<"terminated">((resolve) => {
  const terminationListener = () => {
    resolve("terminated");
  };
  process.once("SIGINT", terminationListener); // interrupt by user
  process.once("SIGTERM", terminationListener); // shutdown by system
});

async function run() {
  let totalScans = 0;
  let totalViruses = 0;

  try {
    while (true) {
      // load files or interrupt
      const readResult = await Unpromise.race([
        readdir("./test/examples/scanned/largedir"),
        terminationPromise,
      ]);
      if (readResult === "terminated") {
        break;
      }
      // find viruses
      const viruses = readResult.filter((name) => name.match(/virus/) !== null);
      // report findings
      console.log(
        `Scan #${totalScans}. ${readResult.length} files. ${viruses.length} viruses found`
      );
      // track totals
      totalScans++;
      totalViruses += viruses.length;
      await sleep(100);
    }
  } finally {
    console.log(
      `Shutting down! \nTotal scans: ${totalScans}. Virus matches: ${totalViruses}`
    );
  }
}

void run();
