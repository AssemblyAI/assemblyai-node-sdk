import { WebSocket } from "mock-socket";

export default class MockWebSocket extends WebSocket {
  // the unused `options` parameter is required for properly mocking the ws WebSocket class
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(address: string | URL, options?: unknown) {
    super(address);
  }

  removeAllListeners() {
    this.listeners = {};
    this.onclose = () => {};
    this.onopen = () => {};
    this.onerror = () => {};
    this.onmessage = () => {};
  }
}
