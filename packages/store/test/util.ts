/** Simple implementation of a 'deferred' Promise value, which
 * defines a useful callback for explicitly resolving the Promise
 */
export function createDeferred<Result>() {
  type Resolve = (result: Result) => void;
  let deferredResolve: Resolve;
  const deferred = new Promise<Result>((resolve) => {
    deferredResolve = resolve;
  });
  return {
    // tell compiler about IIFE assignment ( https://github.com/microsoft/TypeScript/issues/11498 )
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    deferredResolve: deferredResolve!,
    deferred,
  };
}
