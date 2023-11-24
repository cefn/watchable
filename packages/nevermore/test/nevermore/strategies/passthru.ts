/** Proves the reference behaviour of createPassthruPipe. This should be
 * transparent and affect nothing about job behaviours, even though it intercepts
 * all launches and settlements. This ensures it's a good starting reference for
 * any new strategy. */

import { describe, test, expect } from "vitest";

import { iterable2array } from "../../testutil";

import { nevermore, createPassthruPipe } from "../../../src/";

describe("Passthru strategy has no effect", () => {
  test("Simple job sequence", async () => {
    const settlementSequence = nevermore(
      { concurrency: Number.MAX_SAFE_INTEGER, pipes: [createPassthruPipe()] },
      function* () {
        yield async () => "foo";
        yield async () => "bar";
        yield async () => "baz";
      }
    );
    // place all eventual settlements in an array
    const settlements = await iterable2array(settlementSequence);
  });
});
