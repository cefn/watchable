import { useSelected } from "@watchable/store-react";
import { Task } from "./Task";
import { TaskId } from "../task";
import { State } from "../store";
import { Store } from "@watchable/store";

export function Chart(store: Store<State>) {
  const taskIds = useSelected(
    store,
    ({ moments }) => Object.keys(moments) as TaskId[]
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
