import { useSelected } from "@watchable/store-react";
import { STORE_INSTANCE } from "../state/store";
import { normaliseMs, normalizeTask, pc } from "../state/scale";
import { TaskId } from "../task";

export function Task({ id }: { id: TaskId }) {
  const scale = useSelected(STORE_INSTANCE, ({ scale }) => scale);
  const timings = useSelected(STORE_INSTANCE, ({ timings }) => timings[id]);

  return typeof timings === "undefined"
    ? null
    : timings.map((timing) => {
        const {
          promised,
          executed = null,
          fulfilled = null,
          rejected = null,
        } = timing;

        const settled = fulfilled || rejected;

        // calculate horizontal positions according to timings
        const promisedX = normaliseMs(scale, promised);
        const executedX = executed && normaliseMs(scale, executed);
        const settledX = settled && normaliseMs(scale, settled);

        // calculate vertical position according to task position in list
        const taskY = normalizeTask(scale, id);

        // map to rect props
        const executedRectProps = executedX && {
          style: { fill: "blue" },
          x: pc(promisedX),
          y: pc(taskY),
          width: pc(executedX - promisedX),
          height: pc(0.01),
        };
        const settledRectProps = executedX &&
          settledX && {
            style: {
              fill: typeof fulfilled === "number" ? "green" : "red",
            },
            x: pc(executedX),
            y: pc(taskY),
            width: pc(settledX - executedX),
            height: pc(0.01),
          };

        console.log(
          `calculating layout for '${id}': ${JSON.stringify({
            promised: (promised - scale.minMs).toFixed(0),
            executed: executed && (executed - scale.minMs)?.toFixed(0),
            settled: settled && (settled - scale.minMs)?.toFixed(0),
          })}`
        );

        // for non-null rect props, render the rects
        return (
          executedRectProps && (
            <g key={id}>
              <rect {...executedRectProps} />
              {settledRectProps && <rect {...settledRectProps} />}
            </g>
          )
        );
      });
}
