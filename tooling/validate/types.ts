/** A value found at a given path in the package.json */
export type Value = object | string | boolean;

/** A dot-separated (lodash) path to a value. */
export type ValuePath = string;

/** A Rule to reject or replace a value in package.json. Value means itself,
 * `undefined` means delete, `RexExp` means match, `ValueFactory` redirects the
 * check to other logic. */
export type ValueRule = Value | ValueFactory | RegExp | undefined;

/** Logic to calculate a value based on package context */
export type ValueFactory = (packageMeta: PackageMeta) => ValueRule;

/** An operation to align a package with a rule . */
export type ValueFix = (packageMeta: PackageMeta) => void;

export interface PackageMeta {
  packagePath: AbsolutePath;
  packageJson: {
    name: string;
    version: string;
  };
}

/** Rules for controlled ValuePaths in package.json */
export interface PackageJsonSpec {
  [path: ValuePath]: ValueRule;
}

/** Issue when contents of package.json violates a ValueRule */
export interface PackageJsonIssue {
  path: ValuePath;
  message: string;
  fix?: ValueFix;
}

/** Issue when a file in the package is different from skeleton file. */
export interface PackageSkeletonIssue {
  packageFile: AbsolutePath;
  referenceFile: AbsolutePath;
}

export interface ErrorReport {
  errorsFound: number;
  errorsFixed: number;
}

export type AbsolutePath = `/${string}`;
