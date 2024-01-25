/** Canonical 'ValueFactories' that offer semantic sugar
 * with rich editor support for defining alternate package.json
 * validation according to gross features of a package.
 */
import { getPackageType, PackageType } from "./packages";
import { ValueFactory, ValueRule } from "../../types";
import { getRepoPath } from "../util";

/** ValueFactory with distinct values for PackageType 'apps' or 'packages' */
export function byPackageType(
  lookup: Record<PackageType, ValueRule>
): ValueFactory {
  return (packageMeta) => {
    const packageType = getPackageType(packageMeta);
    return lookup[packageType];
  };
}

/** ValueFactory with distinct values for one or more named packages */
export function byPackageName(
  lookup: Record<string, ValueRule>,
  fallback: ValueRule
): ValueFactory {
  return ({ packageJson }) => {
    const { name } = packageJson;
    if (name in lookup) {
      return lookup[name];
    }
    return fallback;
  };
}

/** ValueFactory with distinct values for javascript vs. typescript packages */
export function byPackageLanguage(
  lookup: Record<"ts" | "js", ValueRule>
): ValueFactory {
  return ({ packageJson }) => {
    const language =
      /\bts\b/.test(packageJson.name) || /^@watchable/.test(packageJson.name)
        ? "ts"
        : "js";
    return lookup[language];
  };
}

export function byPackageRelativePath<T>(
  createValueRule: (relativePath: string) => ValueRule
): ValueFactory {
  return ({ packagePath }) => {
    const repoPath = getRepoPath();
    const relativePath = packagePath
      .replace(repoPath + "/", "")
      .replace("/package.json", "");
    return createValueRule(relativePath);
  };
}
