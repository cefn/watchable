// @ts-check

import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import path from "path";
import { fileURLToPath } from "url";

// mimic CommonJS variables -- not needed if using CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...compat.extends(
    "plugin:react/recommended",
    "standard-with-typescript",
    "prettier"
  ),
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "@typescript-eslint/semi": [2, "always"],
      "@typescript-eslint/non-nullable-type-assertion-style": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-empty-interface": [
        "error",
        {
          allowSingleExtends: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-invalid-void-type": [
        "error",
        {
          allowAsThisParameter: true,
        },
      ],
    },
  },
  {
    ignores: [
      "eslint.config.mjs",
      "vite.config.ts",
      "test/examples/*.js",
      "**/*.test.ts",
      "dist",
      "coverage",
      ".wireit",
    ],
  },
];
