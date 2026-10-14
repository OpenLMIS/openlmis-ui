export type QueueTransport = { userId: string };
export class QueueNotSentError extends Error {
  constructor() {
    super('The queued event was not sent because its session is unavailable.');
    this.name = 'QueueNotSentError';
  }
}
