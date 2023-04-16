const rootConfig = require("../../.eslintrc.cjs");
module.exports = {
  ...rootConfig,
  ignorePatterns: [...rootConfig.ignorePatterns, "vite.config.ts"],
  rules: {
    "react/prop-types": "off",
  },
};
