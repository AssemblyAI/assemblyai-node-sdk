import { WebSocket } from "mock-socket";

export default class MockWebSocket extends WebSocket {
  /** The options the client passed to the ws constructor, such as its `headers`. */
  readonly clientOptions?: unknown;

  constructor(address: string | URL, options?: unknown) {
    super(address);
    this.clientOptions = options;
  }

  removeAllListeners() {
    this.listeners = {};
    this.onclose = () => {};
    this.onopen = () => {};
    this.onerror = () => {};
    this.onmessage = () => {};
  }
}
