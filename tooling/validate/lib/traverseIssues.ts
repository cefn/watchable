import { writeFileSync, copyFileSync } from "fs";
import { sep } from "path";
import chalk from "chalk";
import {
  listPackageJsonIssues,
  listPackageJsonPaths,
  loadPackageMeta,
} from "./listRuleIssues";
import type { AbsolutePath, PackageMeta, ErrorReport } from "../types";
import { listPackageSkeletonIssues } from "./listSkeletonIssues";

export async function traverseIssues(
  fixRequested: boolean
): Promise<ErrorReport> {
  let errorsFound = 0;
  let errorsFixed = 0;
  function aggregateErrors(report: ErrorReport) {
    errorsFound += report.errorsFound;
    errorsFixed += report.errorsFixed;
  }

  for (const packagePath of await listPackageJsonPaths()) {
    // fix one package
    const packageMeta = loadPackageMeta(packagePath);
    aggregateErrors(traverseJsonIssues(packageMeta, fixRequested));
    aggregateErrors(traverseSkeletonIssues(packageMeta, fixRequested));
  }

  return {
    errorsFound,
    errorsFixed,
  };
}

/** Generate issues across all  */
export function traverseJsonIssues(
  packageMeta: PackageMeta,
  fixRequested: boolean
): ErrorReport {
  const jsonIssues = [...listPackageJsonIssues(packageMeta)];

  let errorsFound = 0;
  let errorsFixed = 0;
  if (jsonIssues.length > 0) {
    // record package errors
    errorsFound += jsonIssues.length;
    console.log(
      chalk.blue(
        `${packageMeta.packageJson.name} : ${jsonIssues.length} ISSUES `
      )
    );

    // list individual errors, and optionally fix them
    for (const { message, path, fix } of jsonIssues) {
      if (fixRequested) {
        // fix requested
        if (typeof fix === "function") {
          // fix is available
          console.log(chalk.greenBright(`FIXING ${path} : ${message}`));
          fix(packageMeta);
          errorsFixed += 1;
        } else {
          // no fix available
          console.log(chalk.redBright(`CANNOT FIX ${path} : ${message}`));
        }
      } else {
        // no fix requested
        console.log(chalk.yellowBright(`DETECTED ${path} : ${message}`));
      }
    }

    // write package.json including any fixes performed above
    writeFileSync(
      packageMeta.packagePath,
      JSON.stringify(packageMeta.packageJson, null, 2)
    );
  }
  return { errorsFound, errorsFixed };
}

function traverseSkeletonIssues(
  packageMeta: PackageMeta,
  fixRequested: boolean
): ErrorReport {
  const skeletonIssues = [...listPackageSkeletonIssues(packageMeta)];

  if (skeletonIssues.length > 0) {
    for (const { referenceFile, packageFile } of skeletonIssues) {
      if (fixRequested) {
        console.log(
          chalk.greenBright(
            `OVERWRITING ${summaryPath(packageFile)} WITH ${summaryPath(
              referenceFile
            )}`
          )
        );
        copyFileSync(referenceFile, packageFile);
      } else {
        console.log(
          chalk.yellowBright(
            `DETECTED ${summaryPath(packageFile)} DIFFERS FROM ${summaryPath(
              referenceFile
            )}`
          )
        );
      }
    }
  }

  const errorsFound = skeletonIssues.length;
  const errorsFixed = fixRequested ? errorsFound : 0;
  return {
    errorsFound,
    errorsFixed,
  };
}

function summaryPath(path: AbsolutePath) {
  const segments = path.split(sep);
  return segments.slice(segments.length - 3).join(sep);
}
