const rootConfig = require("../../.eslintrc.cjs");
module.exports = {
  ...rootConfig,
  ignorePatterns: [...rootConfig.ignorePatterns, "vite.config.ts"],
};
