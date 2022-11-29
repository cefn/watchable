import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { AbsolutePath } from "../types";

export function typedObjectEntries<Obj extends object>(obj: Obj) {
  type Entry = keyof Obj extends keyof Obj
    ? [keyof Obj, Obj[keyof Obj]]
    : never;
  return Object.entries(obj) as Entry[];
}

export function isMember<Arr extends readonly unknown[]>(
  arr: Arr,
  candidate: unknown
): candidate is Arr[number] {
  return arr.includes(candidate);
}

export function resolveAbsolute(parentPath: AbsolutePath, childPath: string) {
  return resolve(parentPath, childPath) as AbsolutePath;
}

export function getToolingPath() {
  const filePath = fileURLToPath(import.meta.url);
  const dirPath = dirname(filePath);
  return resolve(dirPath, "../../") as AbsolutePath;
}
