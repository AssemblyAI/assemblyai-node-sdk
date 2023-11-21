import { WebSocket } from "mock-socket";

export default class MockWebSocket extends WebSocket {
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
