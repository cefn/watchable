import { describe, test, expect, vi } from "vitest";
import { singletonRace } from "../src/singletonRace";

import "expose-gc";

const { gc } = global;
if (typeof gc === "undefined") {
  throw new Error("Test suite requires --expose-gc");
}

describe("singletonRace", () => {
  describe("async behaviour", () => {
    test("fulfils to tuple containing a single, winning, promise", async () => {
      // construct promises and extract a resolver
      let resolveA!: (value: string) => void;
      const promiseA = new Promise<string>((resolve) => {
        resolveA = resolve;
      });
      const promiseB = new Promise(() => {});

      // resolve promise 'a'
      resolveA("foo");

      const [winner] = await singletonRace([promiseA, promiseB]);

      expect(winner).toBe(promiseA);
      expect(await winner).toBe("foo");
    });
  });

  describe("garbage collection behaviour", () => {
    test("Control: WeakRef scoping", async () => {
      const finalized: string[] = [];
      const registry = new FinalizationRegistry((held: string) => {
        finalized.push(held);
      });

      function createWeakRef() {
        let obj: Record<string, string> | null = { foo: "bar" };
        registry.register(obj, "canary");
        const ref = new WeakRef(obj);
        obj = null;
        return ref;
      }

      const ref = createWeakRef();

      expect(typeof ref.deref()).not.toBe("undefined");

      await vi.waitFor(() => {
        gc();
        expect(typeof ref.deref()).toBe("undefined");
        expect(finalized).toMatchObject(["canary"]);
      });
    });

    test("Control: Promise scoping", async () => {
      function createPromiseRef() {
        let promise: Promise<string> | null = new Promise((resolve) => {
          resolve("foo");
        });
        const ref = new WeakRef(promise);
        promise = null;
        return ref;
      }

      const ref = createPromiseRef();

      expect(typeof ref.deref()).not.toBe("undefined");

      await vi.waitFor(() => {
        gc();
        expect(typeof ref.deref()).toBe("undefined");
      });
    });

    test("Promises are garbage-collected after Promise.race", async () => {
      function createPromiseRef(msg?: string) {
        let promise: Promise<string> | null = new Promise((resolve) => {
          if (typeof msg === "string") {
            resolve(msg);
          }
        });
        const ref = new WeakRef(promise);
        promise = null;
        return ref;
      }

      async function performRace() {
        const refA = createPromiseRef("foo");
        const refB = createPromiseRef();

        const promiseA = refA.deref();
        const promiseB = refB.deref();

        if (
          typeof promiseA === "undefined" ||
          typeof promiseB === "undefined"
        ) {
          throw new Error(`Promise unexpectedly garbage collected before gc()`);
        }

        const winner = await Promise.race([refA.deref(), refB.deref()]);
        expect(winner).toBe("foo");
        return {
          refA,
          refB,
        };
      }

      const { refA, refB } = await performRace();

      expect(typeof refA.deref()).not.toBe("undefined");
      expect(typeof refB.deref()).not.toBe("undefined");

      await vi.waitFor(() => {
        gc();
        expect(typeof refA.deref()).toBe("undefined");
        expect(typeof refB.deref()).toBe("undefined");
      });
    });

    test("Promises are garbage-collected after singletonRace", async () => {
      function createPromiseRef(msg?: string) {
        let promise: Promise<string> | null = new Promise((resolve) => {
          if (typeof msg === "string") {
            resolve(msg);
          }
        });
        const ref = new WeakRef(promise);
        promise = null;
        return ref;
      }

      async function performSingletonRace() {
        const refA = createPromiseRef("foo");
        const refB = createPromiseRef();

        const promiseA = refA.deref();
        const promiseB = refB.deref();

        if (
          typeof promiseA === "undefined" ||
          typeof promiseB === "undefined"
        ) {
          throw new Error(`Promise unexpectedly garbage collected before gc()`);
        }

        const [winner] = await singletonRace([promiseA, promiseB]);
        expect(winner).toBe(promiseA);
        return {
          refA,
          refB,
        };
      }

      const { refA, refB } = await performSingletonRace();

      expect(typeof refA.deref()).not.toBe("undefined");
      expect(typeof refB.deref()).not.toBe("undefined");

      await vi.waitFor(() => {
        gc();
        expect(typeof refA.deref()).toBe("undefined");
        expect(typeof refB.deref()).toBe("undefined");
      });
    });
  });
});
