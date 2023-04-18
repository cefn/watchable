module.exports = {
  ...require("../../jest.config.base.cjs"),
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
};
