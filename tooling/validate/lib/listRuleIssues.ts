import * as jsonDiff from "json-diff";
import { isDeepStrictEqual } from "util";
import { resolve } from "path";
import { readFileSync } from "fs";
import { $ } from "zx";
import {
  get as lodashGet,
  set as lodashSet,
  unset as lodashUnset,
} from "lodash-es";
import { typedObjectEntries } from "./util";
import type {
  PackageMeta,
  PackageJsonIssue,
  Value,
  ValuePath,
  ValueRule,
  AbsolutePath,
} from "../types";
import { PACKAGE_JSON_RULES } from "../ruleConfig";

/** Traverse monorepo to find package.json files */
export async function listPackageJsonPaths() {
  $.verbose = false;
  const relativePackagePaths = (
    await $`ls -1 packages/*/package.json apps/*/package.json`
  ).stdout
    .trim()
    .split("\n");
  $.verbose = true;
  const absolutePackagePaths = relativePackagePaths.map(
    (packagePath) => resolve(packagePath) as AbsolutePath
  );
  return absolutePackagePaths;
}

/** Load path and data for a single package.json */
export function loadPackageMeta(packagePath: AbsolutePath) {
  const packageJson = JSON.parse(
    readFileSync(packagePath).toString()
  ) as PackageMeta["packageJson"];
  return {
    packagePath,
    packageJson,
  };
}

export function* listPackageJsonIssues(
  packageMeta: PackageMeta
): Generator<PackageJsonIssue> {
  for (const [valuePath, valueRule] of typedObjectEntries(PACKAGE_JSON_RULES)) {
    yield* listRuleIssues(packageMeta, valuePath, valueRule);
  }
}

function* listRuleIssues(
  packageMeta: PackageMeta,
  valuePath: ValuePath,
  valueRule: ValueRule
): Generator<PackageJsonIssue> {
  const { packageJson } = packageMeta;
  const actualValue = lodashGet(packageJson, valuePath) as Value | undefined;

  // handle RegExp rules which generate no expected value
  if (valueRule instanceof RegExp && typeof actualValue === "string") {
    if (!valueRule.test(actualValue)) {
      yield {
        message: `Value ${actualValue} doesn't match ${valueRule.toString()}`,
        path: valuePath,
        // fix: omitted. RegExp pattern rules have no automatic fix
      };
    }
    return;
  }

  // call factory until resulting value rule is not itself a factory
  let currentValueRule = valueRule;
  let countIterations = 0;
  const maxIterations = 10;
  while (typeof currentValueRule === "function") {
    // avoid infinite loop
    if (countIterations++ > maxIterations)
      throw new Error(`returned ValueFunction > ${maxIterations} times`);
    // use factory to calculate next rule
    currentValueRule = currentValueRule(packageMeta);
  }
  const expectedValue = currentValueRule;

  // null value means leave unchanged
  if (expectedValue === null) {
    return;
  }

  // handle case where path should be undefined (fix by deletion)
  if (expectedValue === undefined) {
    if (actualValue !== undefined) {
      yield {
        message: `EXPECTED undefined FOUND ${JSON.stringify(actualValue)}`,
        path: valuePath,
        fix: ({ packageJson }) => lodashUnset(packageJson, valuePath),
      };
    }
    return;
  }

  // treat all other cases as expecting equality
  if (!isDeepStrictEqual(actualValue, expectedValue)) {
    const diffString = jsonDiff.diffString(expectedValue, actualValue);
    yield {
      message: `DIFFERS FROM RULE:\n${diffString}`,
      path: valuePath,
      fix: ({ packageJson }) =>
        lodashSet(packageJson, valuePath, expectedValue),
    };
  }
}
