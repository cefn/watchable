import { createStructuredSelector } from "reselect";

type RootState = object;

/** A collection of named selectors */
type SelectorMap<State extends object> = Record<
  string,
  (state: State) => unknown
>;

/** Selector returning a map of values returned from correspondingly-named selectors */
type MappedSelector<State extends object, M extends SelectorMap<State>> = (
  state: State
) => {
  [k in keyof M]: ReturnType<M[k]>;
};

export function createMappedSelector<
  S extends RootState,
  M extends SelectorMap<S>
>(selectorMap: M): MappedSelector<S, M> {
  return createStructuredSelector(selectorMap) as MappedSelector<S, M>;
}

const selectorEntries = keys.map((key) => [key, (state: T) => state[key]]);
return createStructuredSelector<Picked<T, Keys>>(
  Object.fromEntries(selectorEntries)
);

/*
const [selector] = useState(() =>
  createMappedSelector<BabyNames>({
    child: (state) => state.grandparent.parent.child,
    aunt: (state) => state.grandparent.aunt,
  })
);
const { child, aunt } = useSelected(selector);



const [selector] = useState(() =>
  createPathsSelector<BabyNames>("grandparent.parent.child", "grandparent.aunt")
);
const { child, aunt } = useSelected(selector);
*/
