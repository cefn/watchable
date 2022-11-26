module.exports = {
  roots: ["<rootDir>/src", "<rootDir>/test"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  testRegex: "(/test/.*.(test|spec)).(jsx?|tsx?)$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  collectCoverage: true,
  coveragePathIgnorePatterns: ["(test/.*.mock).(jsx?|tsx?)$"],
  verbose: true,
  projects: ["<rootDir>"],
  coverageDirectory: "<rootDir>/coverage/",
  preset: "ts-jest",
  moduleNameMapper: {
    "@lauf/([^/]+)": "<rootDir>../../packages/$1/src",
  },
};
