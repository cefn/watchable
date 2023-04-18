const rootConfig = require("../../.eslintrc.cjs");
module.exports = {
  ...rootConfig,
  parserOptions: {
    ...rootConfig.parserOptions,
    tsconfigRootDir: __dirname,
    project: "tsconfig.test.json",
  },
};
