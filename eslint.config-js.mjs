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
  ...compat.extends("plugin:react/recommended", "standard", "prettier"),
  {
    files: ["src/**/*.js", "src/**/*.jsx"],
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/prop-types": "off",
    },
  },
  {
    ignores: [
      "eslint.config.mjs",
      "vite.config.ts",
      "vite.config.ts*",
      "**/*.test.ts",
      "dist",
      "coverage",
      ".wireit",
    ],
  },
];
