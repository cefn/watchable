import { sep } from "path";
import { isMember } from "./util";

export interface PackageMeta {
  packagePath: AbsolutePath;
  packageJson: {
    name: string;
    version: string;
  };
}

/** Rules for controlled ValuePaths in package.json */
export type PackageJsonSpec = {
  [path: ValuePath]: ValueRule;
};

/** Issue when contents of package.json violates a ValueRule */
export type PackageJsonIssue = {
  path: ValuePath;
  message: string;
  fix?: ValueFix;
};

/** Issue when a file in the package is different from skeleton file. */
export type PackageSkeletonIssue = {
  packageFile: AbsolutePath;
  referenceFile: AbsolutePath;
};

export interface ErrorReport {
  errorsFound: number;
  errorsFixed: number;
}

export type AbsolutePath = `/${string}`;

/** A value found at a given path in the package.json */
export type Value = object | string | boolean;

/** A dot-separated (lodash) path to a value. */
export type ValuePath = string;

/** A Rule to reject or replace a value in package.json  */
export type ValueRule = Value | ValueFactory | RegExp | undefined;

/** Logic to calculate a value based on package context, `undefined` means delete, `null` means leave value unmodified. */
export type ValueFactory = (
  packageMeta: PackageMeta
) => Value | undefined | null;

/** An operation to align a package with a rule . */
export type ValueFix = (packageMeta: PackageMeta) => void;

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
