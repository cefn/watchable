import {
  byPackageLanguage,
  byPackageName,
  byPackageType,
} from "./lib/rules/factories";
import { getUpstreamBuildDependencies } from "./lib/rules/packages";
import type { PackageJsonSpec } from "./types";

export const PACKAGE_JSON_RULES = {
  type: byPackageName({ "counter-dom-commonjs": "commonjs" }, "module"),
  sideEffects: byPackageType({ packages: false, apps: undefined }),
  license: "MIT",
  author: "Cefn Hoile <github.com@cefn.com> (https://cefn.com)",
  repository: "github:cefn/watchable",
  homepage: "https://github.com/cefn/watchable/tree/main/modules/store#readme",
  bugs: {
    url: "https://github.com/cefn/watchable/issues",
    email: "watchable@cefn.com",
  },
  "devDependencies.typescript": byPackageLanguage({
    ts: "^5.0.4",
    js: undefined,
  }),
  "devDependencies.wireit": "^0.9.5",
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
    command: "eslint -c .eslintrc.cjs .",
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.jsx"],
    output: [],
    dependencies: ["build"],
  },
  "wireit.build": (packageMeta) => {
    const dependencies = getUpstreamBuildDependencies(packageMeta);
    const common = dependencies != null ? { dependencies } : null;
    return byPackageLanguage({
      js: {
        ...common,
        command: "vite build",
        files: ["vite.config.ts", "src/**/*"],
        output: ["./dist"],
      },
      ts: byPackageType({
        apps: {
          ...common,
          command: "tsc && vite build",
          files: [
            "src/**/*",
            "vite.config.ts",
            "tsconfig.build.json",
            "../../tsconfig.base.json",
          ],
          output: ["./dist"],
        },
        packages: {
          ...common,
          command: "tsc && vite build",
          files: [
            "src/**/*",
            "tsconfig.json",
            "tsconfig.build.json",
            "../../tsconfig.base.json",
            "vite.config.ts",
          ],
          output: ["./dist"],
        },
      }),
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
      command: "jest",
      files: [
        "src/**/*",
        "test/**/*",
        "tsconfig.json",
        "jest.config.cjs",
        "../../jest.config.base.cjs",
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
        "jest.config.cjs",
        "../../jest.config.base.cjs",
      ],
      output: ["dist", "coverage", "playwright-report"],
    };

    return byPackageType({
      packages: tsPackages,
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
      },
    },
  }),
  files: byPackageType({
    apps: undefined,
    packages: ["README.md", "dist", "src"],
  }),
} as const satisfies PackageJsonSpec;
