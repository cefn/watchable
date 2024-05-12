import {
  byPackageLanguage,
  byPackageName,
  byPackageRelativePath,
  byPackageType,
} from "./lib/rules/factories";
import { getUpstreamBuildDependencies } from "./lib/rules/packages";
import { getRepoPath } from "./lib/util";
import type { PackageJsonSpec } from "./types";

import rootPackageJson from "../../package.json";

const {
  devDependencies: {
    vite: VITE_VERSION,
    vitest: VITEST_VERSION,
    wireit: WIREIT_VERSION,
  },
} = rootPackageJson;

export const PACKAGE_JSON_RULES = {
  type: byPackageName({ "counter-dom-commonjs": "commonjs" }, "module"),
  sideEffects: byPackageType({ packages: false, apps: undefined }),
  license: "MIT",
  author: "Cefn Hoile <github.com@cefn.com> (https://cefn.com)",
  repository: byPackageRelativePath((relativePath) => ({
    url: "https://github.com/cefn/watchable.git",
    directory: relativePath,
  })),
  homepage: byPackageRelativePath(
    (relativePath) =>
      `https://github.com/cefn/watchable/tree/main/${relativePath}#readme`
  ),
  bugs: ({ packageJson }) => {
    const { name } = packageJson;
    const shortName = name.replace(/@watchable\//, "");
    return {
      url: `https://github.com/cefn/watchable/issues?q=is%3Aissue+is%3Aopen+label%3A${shortName}`,
      email: "watchable@cefn.com",
    };
  },
  "devDependencies.typescript": byPackageLanguage({
    ts: "^5.4.5",
    js: undefined,
  }),
  "devDependencies.vite": byPackageType({
    apps: byPackageName(
      {
        "counter-preact-ts": VITE_VERSION,
        "counter-react-ts": VITE_VERSION,
        "counter-react-js": VITE_VERSION,
        "counter-react-ts-edit": VITE_VERSION,
        "counter-react-ts-edit-context": VITE_VERSION,
      },
      null
    ),
    packages: VITE_VERSION,
  }),
  "devDependencies.vitest": byPackageType({
    apps: byPackageName(
      {
        "counter-preact-ts": VITEST_VERSION,
        "counter-react-ts": VITEST_VERSION,
        "counter-react-js": VITEST_VERSION,
        "counter-react-ts-edit": VITEST_VERSION,
        "counter-react-ts-edit-context": VITEST_VERSION,
      },
      undefined
    ),
    packages: VITEST_VERSION,
  }),
  "devDependencies.wireit": WIREIT_VERSION,
  "scripts.test:unit": byPackageType({
    apps: byPackageName(
      {
        "counter-preact-ts": "vitest run",
        "counter-react-ts": "vitest run",
        "counter-react-ts-edit": "vitest run",
        "counter-react-ts-edit-context": "vitest run",
      },
      undefined
    ),
    packages: undefined,
  }),
  "scripts.test": byPackageType({
    packages: "wireit",
    apps: byPackageName(
      {
        "counter-preact-ts": "wireit",
        "counter-react-ts": "wireit",
        "counter-react-ts-edit": "wireit",
        "counter-react-ts-edit-context": "wireit",
      },
      undefined // delete
    ),
  }),
  "scripts.lint": "wireit",
  "scripts.build": "wireit",
  "wireit.lint": {
    command: "eslint .",
    files: [
      "**/*.js",
      "**/*.jsx",
      "**/*.ts",
      "**/*.jsx",
      "!dist/**/*",
      "!coverage/**/*",
    ],
    output: [],
    dependencies: ["build"],
  },
  "wireit.build": (packageMeta) => {
    const dependencies = getUpstreamBuildDependencies(packageMeta);

    const common = dependencies != null ? { dependencies } : null;

    const jsBuild = {
      ...common,
      command: "vite build",
      files: ["vite.config.ts", "src/**/*"],
      output: ["./dist"],
    };

    const tsBuild = byPackageType({
      apps: {
        ...common,
        command: "tsc --build && vite build",
        files: ["src/**/*", "vite.config.ts", "../../tsconfig.base.json"],
        output: ["./dist"],
      },
      packages: {
        ...common,
        command: "tsc --build && vite build",
        files: ["src/**/*", "tsconfig.json", "vite.config.ts", "README.md"],
        output: ["./dist"],
      },
    });

    return byPackageLanguage({
      js: jsBuild,
      ts: tsBuild,
    });
  },
  /** Populate test dependencies according to package dependencies. E.g
   * store-follow will only be tested when the store tests pass.
   * Note: The wireit.test.dependencies stanza is populated later.  */
  "wireit.test": (packageMeta) => {
    const upstreamBuilds = getUpstreamBuildDependencies(packageMeta);
    const common = {
      dependencies: ["build", ...(upstreamBuilds ?? [])],
    };

    const tsPackages = {
      ...common,
      command: "vitest run --reporter verbose",
      files: [
        "src/**/*",
        "test/**/*",
        "tsconfig.json",
        "tsconfig.test.json",
        "vite.config.ts",
      ],
      output: ["./coverage"],
      dependencies: ["build"],
    };

    const tsAppsWithUnitTests = {
      ...common,
      command: "run-s test:unit test:dev:bundle",
      files: [
        "src/**/*",
        "test/**/*",
        "index.html",
        "playwright.config.ts",
        "tsconfig.json",
        "vite.config.ts",
        "waitOnConfig.json",
      ],
      output: ["coverage", "playwright-report"],
    };

    const nevermoreTests = {
      ...tsPackages,
      command: "vitest run --reporter verbose --isolate",
    };

    return byPackageType({
      packages: byPackageName(
        { "@watchable/nevermore": nevermoreTests },
        tsPackages
      ),
      apps: byPackageName(
        {
          "counter-preact-ts": tsAppsWithUnitTests,
          "counter-react-ts": tsAppsWithUnitTests,
          "counter-react-ts-edit": tsAppsWithUnitTests,
          "counter-react-ts-edit-context": tsAppsWithUnitTests,
        },
        undefined // delete
      ),
    });
  },
  publishConfig: byPackageType({
    apps: undefined,
    packages: {
      access: "public",
    },
  }),
  private: byPackageType({
    apps: true,
    packages: undefined,
  }),
  main: byPackageType({
    apps: undefined,
    packages: "dist/index.js",
  }),
  types: byPackageType({
    apps: undefined,
    packages: "dist/index.d.ts",
  }),
  exports: byPackageType({
    apps: undefined,
    packages: {
      ".": {
        import: "./dist/index.js",
        require: "./dist/index.cjs",
        default: "./dist/index.cjs",
      },
    },
  }),
  files: byPackageType({
    apps: undefined,
    packages: ["README.md", "dist", "src"],
  }),
} as const satisfies PackageJsonSpec;
