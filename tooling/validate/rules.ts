import {
  PackageJsonSpec,
  Value,
  ValueFactory,
  getPackageType,
  PackageType,
  SCOPE,
} from "./lib/types";

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
  "devDependencies.typescript": byPackageName(
    { "counter-dom-js": undefined },
    "^4.9.3"
  ),
  "devDependencies.wireit": "^0.8.0",
  "scripts.test": byNonNull(
    byPackageType({
      packages: "wireit",
      apps: null, // pass
    }),
    byPackageName(
      {
        "counter-react-ts": "wireit",
      },
      undefined // delete
    )
  ),
  "scripts.check": "wireit",
  "scripts.lint": "wireit",
  "scripts.build": "wireit",
  "wireit.check": byPackageName(
    { "counter-dom-js": undefined, "counter-react-js": undefined },
    {
      command: "tsc --noEmit",
      files: ["src/**/*.ts", "test/**/*.ts"],
      output: [],
    }
  ),
  "wireit.lint": {
    command: "eslint",
    files: ["**/*"],
    output: [],
  },
  "wireit.build": byNonNull(
    byPackageType({
      packages: {
        command:
          "rimraf dist && node ./esbuild.cjs && tsc --declaration --emitDeclarationOnly --outDir dist --project ./tsconfig.build.json",
        files: ["src/**/*", "tsconfig.json", "esbuild.cjs"],
        output: ["./dist"],
      },
      apps: null, // pass
    }),
    byPackageName(
      {
        "counter-dom-js": {
          command: "vite build",
          files: ["src/**/*"],
          output: ["./dist"],
        },
        "counter-react-js": {
          command: "vite build",
          files: ["src/**/*", "vite.config.js"],
          output: ["./dist"],
        },
      },
      {
        command: "tsc && vite build",
        files: ["src/**/*", "tsconfig.json", "esbuild.cjs"],
        output: ["./dist"],
      }
    )
  ),
  /** Note: The wireit.test.dependencies stanza is populated later.  */
  "wireit.test": byNonNull(
    byPackageType({
      packages: {
        command: "jest",
        files: [
          "src/**/*",
          "test/**/*",
          "tsconfig.json",
          "jest.config.cjs",
          "../../jest.config.base.cjs",
        ],
        output: ["./coverage"],
      },
      apps: null, // pass
    }),
    byPackageName(
      {
        "counter-react-ts": null, // special case - leave alone
      },
      undefined // delete
    )
  ),
  /** Note: The wireit.test stanza was populated earlier */
  "wireit.test.dependencies": ({ packageJson }) => {
    const upstreamScripts = [];
    type OptionalJson = {
      dependencies?: {};
      peerDependencies?: {};
      wireit?: {};
    };
    const { dependencies, peerDependencies, wireit } =
      packageJson as OptionalJson;
    if (wireit && "test" in wireit) {
      const deps = {
        ...dependencies,
        ...peerDependencies,
      };
      for (const dependency of Object.keys(deps)) {
        const [scope, name] = dependency.split("/");
        if (scope === SCOPE) {
          // depend on upstream test
          upstreamScripts.push(`../../packages/${name}:test`);
        }
      }
    }
    return upstreamScripts.length ? upstreamScripts : null;
  },
  main: byPackageType({
    apps: undefined,
    packages: "dist/index.js",
  }),
  publishConfig: byPackageType({
    apps: undefined,
    packages: {
      access: "public",
      main: "dist/index.js",
      typings: "dist/index.d.ts",
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
  eslintConfig: {
    ignorePatterns: ["dist/**"],
    rules: {
      "@typescript-eslint/no-empty-interface": [
        "error",
        {
          allowSingleExtends: true,
        },
      ],
      "no-param-reassign": [
        "error",
        {
          props: true,
          ignorePropertyModificationsFor: ["draft"],
        },
      ],
      "no-restricted-syntax": [
        "error",
        "ForInStatement",
        "LabeledStatement",
        "WithStatement",
      ],
      "no-void": [
        "error",
        {
          allowAsStatement: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
        },
      ],
      "import/prefer-default-export": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "react/prop-types": "off",
    },
  },
} as const satisfies PackageJsonSpec;

/** Create a ValueFactory with distinct values for each PackageType */
function byPackageType(
  lookup: Record<PackageType, Value | undefined | null>
): ValueFactory {
  return (packageMeta) => {
    const packageType = getPackageType(packageMeta);
    return lookup[packageType];
  };
}

/** Create a ValueFactory with distinct values for one or more named packages */
function byPackageName(
  lookup: Record<string, Value | undefined | null>,
  fallback: Value | undefined | null
): ValueFactory {
  return ({ packageJson }) => {
    const { name } = packageJson;
    if (name in lookup) {
      return lookup[name];
    }
    return fallback;
  };
}

/** Runs each ValueFactory in turn returning the first non-null value (at least
 * two factories must be provided). */
function byNonNull(
  ...factories: [ValueFactory, ValueFactory, ...ValueFactory[]]
): ValueFactory {
  return (packageMeta) => {
    for (const factory of factories) {
      const result = factory(packageMeta);
      if (result !== null) {
        // value should be overwritten with the non-null value
        return result;
      }
    }
    // value should not be overwritten
    return null;
  };
}
