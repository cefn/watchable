const rootConfig = require("../../.eslintrc.cjs");
module.exports = {
  ...rootConfig,
  parserOptions: {
    ...rootConfig.parserOptions,
  },
};
