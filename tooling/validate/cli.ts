import chalk from "chalk";
import { parseArgs } from "node:util";
import { traverseIssues } from "./lib/traverse";

// read --fix or -f arg
const args = process.argv.slice(2);
const { values } = parseArgs({
  args,
  options: {
    fix: {
      type: "boolean",
      short: "f",
    },
  },
});
const { fix = false } = values;

// perform validation
const { errorsFixed, errorsFound } = await traverseIssues(fix);

// report validation result to console
const message =
  errorsFound > 0
    ? `TOTAL VALIDATION ERRORS ${errorsFound} FIXED ${errorsFixed}`
    : `NO VALIDATION ERRORS FOUND`;

const { bgGreenBright, bgYellowBright, bgRedBright } = chalk;

const colorFn =
  errorsFound === 0
    ? bgGreenBright
    : errorsFound === errorsFixed
    ? bgYellowBright
    : bgRedBright;

console.log(colorFn(message));

if (errorsFound > 0) {
  process.exit(-1);
}
