import { createQueue } from "../src";

describe("BasicMessageQueue behaviour", () => {
  test("Create a BasicMessageQueue", () => {
    createQueue();
  });

  test("Receive from BasicMessageQueue in same order as sent", async () => {
    const queue = createQueue();
    queue.send("foo");
    queue.send("bar");
    queue.send("baz");
    expect(await queue.receive()).toEqual("foo");
    expect(await queue.receive()).toEqual("bar");
    expect(await queue.receive()).toEqual("baz");
  });

  test("Send to BasicMessageQueue before receiving", async () => {
    const queue = createQueue();
    queue.send("foo");
    expect(await queue.receive()).toEqual("foo");
  });

  test("Receive from BasicMessageQueue before sending", async () => {
    const queue = createQueue();
    const messagePromise = queue.receive();
    queue.send("foo");
    expect(await messagePromise).toEqual("foo");
  });

  test("Overfill a BasicMessageQueue", () => {
    const maxItems = 2;
    const maxConsumers = Number.MAX_SAFE_INTEGER;
    const queue = createQueue<string>(maxItems, maxConsumers);
    expect(queue.send("foo")).toBe(true);
    expect(queue.send("bar")).toBe(true);
    expect(queue.send("baz")).toBe(false);
  });

  test("Oversubscribe a BasicMessageQueue", () => {
    const maxItems = Number.MAX_SAFE_INTEGER;
    const maxConsumers = 2;
    const queue = createQueue<string>(maxItems, maxConsumers);
    void queue.receive();
    void queue.receive();
    expect(() => {
      void queue.receive();
    }).toThrow();
  });
});
