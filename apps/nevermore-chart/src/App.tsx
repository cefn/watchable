import { useEffect } from "react";
import "./App.css";
import { Chart } from "./scenario/components/Chart";

import { launchAllSettled } from "./scenario/launch";
import { STORE_INSTANCE } from "./scenario/state/store";
import { edit } from "@watchable/store-edit";
import { now } from "./scenario/state/timing";

async function run() {
  edit(STORE_INSTANCE, (state) => {
    state.scale.minMs = now();
    state.scale.maxMs = now() + 1;
    state.timings = {};
  });
  await launchAllSettled();
}

function App() {
  useEffect(() => void run(), []);

  return (
    <>
      <div style={{ width: "100%" }}>
        <button type="button" onClick={run}>
          Run
        </button>
        <Chart />
      </div>
    </>
  );
}

export default App;
