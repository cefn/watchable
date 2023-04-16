import {
  byPackageLanguage,
  byPackageName,
  byPackageType,
} from "./lib/rules/factories";
import { getUpstreamBuildDependencies } from "./lib/rules/packages";
import type { PackageJsonSpec } from "./types";

export const PACKAGE_JSON_RULES = {
  type: "module",
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
        "counter-react-ts": "wireit",
        "counter-react-ts-context": "wireit",
        "counter-react-ts-edit": "wireit",
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
        files: ["src/**/*"],
        output: ["./dist"],
      },
      ts: byPackageType({
        apps: {
          ...common,
          command: "tsc && vite build",
          files: [
            "src/**/*",
            "tsconfig.build.json",
            "../../tsconfig.base.json",
            "esbuild.cjs",
            "../../esbuild.base.cjs",
          ],
          output: ["./dist"],
        },
        packages: {
          ...common,
          command: "node ./esbuild.cjs && tsc --build",
          files: [
            "src/**/*",
            "tsconfig.json",
            "tsconfig.build.json",
            "../../tsconfig.base.json",
            "esbuild.cjs",
            "../../esbuild.base.cjs",
          ],
          output: ["./dist"],
        },
      }),
    });
  },
  /** Note: The wireit.test.dependencies stanza is populated later.  */
  "wireit.test": (packageMeta) => {
    const upstreamBuilds = getUpstreamBuildDependencies(packageMeta);
    const common = {
      dependencies: ["build", ...(upstreamBuilds ?? [])],
    };

    const forPackages = {
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

    const forTsAppsNoUnitTests = {
      ...common,
      command: "run-s test:dev:bundle",
      files: [
        "src/**/*",
        "test/**/*",
        "index.html",
        "playwright.config.ts",
        "tsconfig.json",
        "vite.config.ts",
        "waitOnConfig.json",
      ],
      output: ["dist", "coverage", "playwright-report"],
    };

    const forTsAppsWithUnitTests = {
      ...forTsAppsNoUnitTests,
      command: "run-s test:unit test:dev:bundle",
      files: [
        ...forTsAppsNoUnitTests.files,
        "jest.config.cjs",
        "../../jest.config.base.cjs",
      ],
    };

    return byPackageType({
      packages: forPackages,
      apps: byPackageName(
        {
          "counter-react-ts": forTsAppsWithUnitTests,
          "counter-react-ts-context": forTsAppsWithUnitTests,
          "counter-react-ts-edit": forTsAppsNoUnitTests,
        },
        undefined // delete
      ),
    });
  },
  main: byPackageType({
    apps: undefined,
    packages: "dist/index.js",
  }),
  types: byPackageType({
    apps: undefined,
    packages: "dist/index.d.ts",
  }),
  publishConfig: byPackageType({
    apps: undefined,
    packages: {
      access: "public",
      main: "dist/index.js",
      types: "dist/index.d.ts",
    },
  }),
  private: byPackageType({
    apps: true,
    packages: undefined,
  }),
  files: byPackageType({
    apps: undefined,
    packages: ["README.md", "dist"],
  }),
} as const satisfies PackageJsonSpec;
