import type { MessageQueue, Watcher } from "./types";

class DefaultMessageQueue<Message> implements MessageQueue<Message> {
  // items passed to send when no receiver was waiting for callback
  messages: readonly Message[] = [];
  // callbacks passed to receive when no item was waiting to send
  receivers: ReadonlyArray<Watcher<Message>> = [];
  // TODO offer ops to at least count, possibly manipulate, message list
  constructor(
    readonly maxMessages = Number.MAX_SAFE_INTEGER,
    readonly maxReceivers = Number.MAX_SAFE_INTEGER
  ) {}

  // TODO make async, await Promise.resolve() to push event into next
  // tick, await receiver
  send = (message: Message) => {
    if (this.receivers.length > 0) {
      const [receiver, ...rest] = this.receivers as [Watcher<Message>];
      this.receivers = rest;
      receiver(message);
      return true;
    }
    if (this.messages.length < this.maxMessages) {
      this.messages = [...this.messages, message];
      return true;
    } else {
      return false;
    }
  };

  // TODO add a boolean option here for non-blocking?
  // CH following eslint rule breaks tests by changing async behaviour
  // consider making async and rewriting tests
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  receive = () => {
    if (this.messages.length > 0) {
      const [message, ...rest] = this.messages as [Message];
      this.messages = rest;
      return Promise.resolve(message);
    } else if (this.receivers.length < this.maxReceivers) {
      return new Promise<Message>((resolve) => {
        this.receivers = [...this.receivers, resolve];
      });
    } else {
      throw new Error(`Queue already has ${this.maxReceivers} receivers`);
    }
  };
}

/**
 * Create a new {@link MessageQueue}, with no backlog limits by default.
 * @param messageBacklog Maximum backlog of waiting messages before {@link MessageQueue.send send()} returns `false`
 * @param receiverBacklog Maximum backlog of waiting receivers before {@link MessageQueue.receive receive()} throws an Error
 * @returns a {@link MessageQueue} with the specified backlog limits
 */
export function createQueue<T>(
  messageBacklog?: number,
  receiverBacklog?: number
): MessageQueue<T> {
  return new DefaultMessageQueue(messageBacklog, receiverBacklog);
}
