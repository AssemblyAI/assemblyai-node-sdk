export type PollingOptions = {
  /**
   * The amount of time to wait between polling requests.
   * @default 3000 or every 3 seconds
   */
  pollingInterval?: number;
  /**
   * The maximum amount of time to wait for the transcript to be ready.
   * @default -1 which means wait forever
   */
  pollingTimeout?: number;
};
export type CreateTranscriptOptions = {
  /**
   * Whether to poll the transcript until it is ready.
   * @default true
   */
  poll?: boolean;
} & PollingOptions;
