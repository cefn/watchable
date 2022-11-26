/** Function subscribed to be notified of an item T.  */
export type Watcher<T> = (item: T) => unknown;

/**
 * Handles delivery of a sequence of sent `Messages` - which can be any javascript value - for
 * one or more receivers to process when they are ready.
 *
 */
export interface MessageQueue<Message> {
  /**
   * Delivers message to any waiting [[receive|receive()]] call or adds to a
   * backlog for a future caller to receive.
   */
  send: (message: Message) => boolean;
  /**
   * Takes a message from the message backlog
   * or waits for the next [[send|send()]] call if there is no backlog.
   */
  receive: () => Promise<Message>;
}
