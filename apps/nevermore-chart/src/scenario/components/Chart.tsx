import { useSelected } from "@watchable/store-react";
import { STORE_INSTANCE } from "../state/store";
import { Task } from "./Task";
import { TaskId } from "../task";

export function Chart() {
  const taskIds = useSelected(
    STORE_INSTANCE,
    ({ timings }) => Object.keys(timings) as TaskId[]
  );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      viewBox="0 0 50 50"
    >
      {taskIds.map((taskId) => (
        <Task key={taskId} id={taskId} />
      ))}
    </svg>
  );
}
