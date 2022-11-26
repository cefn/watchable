import { readdirSync, readFileSync } from "fs";
import { dirname } from "path";
import {
  AbsolutePath,
  PackageSkeletonIssue,
  PackageMeta,
  getPackageType,
} from "./types";
import { getToolingPath, resolveAbsolute } from "./util";

export function* listPackageSkeletonIssues(packageMeta: PackageMeta) {
  const roots = ["shared", getPackageType(packageMeta)]; // e.g. ["shared", "apps"] or ["shared", "packages"]
  for (const root of roots) {
    const referencePath = resolveAbsolute(
      getToolingPath(),
      `./validate/skeleton/${root}`
    );
    yield* listReferencePathIssues(packageMeta, referencePath);
  }
}

export function* listReferencePathIssues(
  { packagePath }: PackageMeta,
  referenceRoot: AbsolutePath
): Generator<PackageSkeletonIssue> {
  // derive root from package.json path
  const packageRoot = dirname(packagePath) as AbsolutePath;
  // get folder listings
  const referenceFileNames = readdirSync(referenceRoot);
  const packageFileNames = readdirSync(packageRoot);

  // check all reference file contents are identical with package file contents
  for (const fileName of referenceFileNames) {
    const referenceFile = resolveAbsolute(referenceRoot, fileName);
    const packageFile = resolveAbsolute(packageRoot, fileName);

    if (packageFileNames.includes(fileName)) {
      if (readFileSync(referenceFile).equals(readFileSync(packageFile))) {
        // file exactly matches
        continue;
      }
    }

    // file missing or mismatched
    yield {
      referenceFile,
      packageFile,
    };
  }
}
