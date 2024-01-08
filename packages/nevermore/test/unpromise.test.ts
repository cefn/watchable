/* eslint-disable @typescript-eslint/promise-function-async */
import { describe, test, expect } from "vitest";
import { Unpromise } from "../src/unpromise";

function sleep(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

describe("Unpromise", () => {
  describe("alignment with native promise", () => {
    test("Promise resolves (CONTROL)", async () => {
      const promise = sleep(1).then(() => "foo");
      expect(await promise).toBe("foo");
    });

    test("Unpromise resolves (subscribed)", async () => {
      // create Unpromise immediately (don't give promise a chance to settle)
      const unpromise = Unpromise.get(sleep(1).then(() => "foo"));
      expect(await unpromise).toBe("foo");
    });

    test("Unpromise resolves (settled)", async () => {
      // create promise
      const promise = sleep(1).then(() => "foo");

      // allow it to settle
      await promise;

      // create Unpromise from settled promise
      const unpromise = Unpromise.get(promise);
      expect(await unpromise).toBe("foo");
    });

    test("Promise rejects (CONTROL)", async () => {
      const promise = sleep(1).then(() => {
        throw new Error("bar");
      });

      try {
        await promise;
      } catch (error) {
        expect(error).toEqual(new Error("bar"));
      }
    });

    test("Unpromise rejects (subscribed)", async () => {
      // create Unpromise immediately (without underlying promise having time to settle)
      const unpromise = Unpromise.get(
        sleep(1).then(() => {
          throw new Error("bar");
        })
      );

      try {
        await unpromise;
      } catch (error) {
        expect(error).toEqual(new Error("bar"));
      }
    });

    test("Unpromise rejects (settled)", async () => {
      // create promise
      const promise = sleep(1).then(() => {
        throw new Error("bar");
      });

      // allow it to settle
      try {
        await promise;
      } catch (error) {
        // ignore error
      }

      // then create Unpromise
      const unpromise = Unpromise.get(promise);

      try {
        await unpromise;
      } catch (error) {
        expect(error).toEqual(new Error("bar"));
      }
    });

    test("Promise finally - then condition (CONTROL)", async () => {
      let finallyCalled = false;
      try {
        await sleep(1);
      } catch (error) {
        // do nothing - error is expected
      } finally {
        finallyCalled = true;
      }
      expect(finallyCalled).toBe(true);
    });

    test("Promise finally - catch condition (CONTROL)", async () => {
      let finallyCalled = false;
      try {
        await sleep(1).then(() => {
          throw new Error("bar");
        });
      } catch (error) {
        // do nothing - error is expected
      } finally {
        finallyCalled = true;
      }
      expect(finallyCalled).toBe(true);
    });

    test("Unpromise finally - then condition (subscribed)", async () => {
      let finallyCalled = false;
      try {
        await Unpromise.get(sleep(1));
      } catch (error) {
        // do nothing - error is expected
      } finally {
        finallyCalled = true;
      }
      expect(finallyCalled).toBe(true);
    });

    test("Unpromise finally - catch condition (subscribed)", async () => {
      let finallyCalled = false;
      try {
        await Unpromise.get(
          sleep(1).then(() => {
            throw new Error("bar");
          })
        );
      } catch (error) {
        // do nothing - error is expected
      } finally {
        finallyCalled = true;
      }
      expect(finallyCalled).toBe(true);
    });

    test("Unpromise finally - then condition (settled)", async () => {
      // create promise
      const promise = sleep(1);

      // allow promise to settle
      await promise;

      let finallyCalled = false;
      try {
        await Unpromise.get(promise);
      } catch (error) {
        // do nothing - error is expected
      } finally {
        finallyCalled = true;
      }
      expect(finallyCalled).toBe(true);
    });

    test("Unpromise finally - catch condition (settled)", async () => {
      const promise = sleep(1).then(() => {
        throw new Error("bar");
      });

      try {
        await promise;
      } catch (error) {
        // error is expected
      }

      let finallyCalled = false;
      try {
        await Unpromise.get(promise);
      } catch (error) {
        // do nothing - error is expected
      } finally {
        finallyCalled = true;
      }
      expect(finallyCalled).toBe(true);
    });
  });
});
