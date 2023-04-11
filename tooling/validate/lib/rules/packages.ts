import { sep } from "path";
import { PackageMeta } from "tooling/validate/types";
import { isMember } from "../util";

/** The scope prefix (soon to be changed to watchable). */
export const SCOPE = "@lauf";

const PACKAGE_TYPES = ["apps", "packages"] as const;
export type PackageType = typeof PACKAGE_TYPES[number];

/** Check if package is in `apps` or `packages` folder. */
export function getPackageType({ packagePath }: PackageMeta) {
  const pathSegments = packagePath.split(sep);
  const lastSegments = pathSegments.slice(pathSegments.length - 3);
  const [packageType, _packageSlug, _jsonFileName] = lastSegments;
  if (isMember(PACKAGE_TYPES, packageType)) {
    return packageType;
  }
  throw new Error(`Could not extract packageType from ${packagePath}`);
}

function getUpstreamNames({ packageJson }: PackageMeta) {
  const upstreamNames: string[] = [];
  interface OptionalJson {
    dependencies?: {};
    peerDependencies?: {};
    wireit?: {};
  }
  const { dependencies, peerDependencies } = packageJson as OptionalJson;
  const deps = {
    ...dependencies,
    ...peerDependencies,
  };
  for (const scopedName of Object.keys(deps)) {
    const [scope, name] = scopedName.split("/");
    if (name !== undefined && scope === SCOPE) {
      // depend on upstream test
      upstreamNames.push(name);
    }
  }
  return upstreamNames.length > 0 ? upstreamNames : null;
}

export function getUpstreamBuildDependencies(packageMeta: PackageMeta) {
  return getUpstreamNames(packageMeta)?.map(
    (upstreamName) => `../../packages/${upstreamName}:build`
  );
}
