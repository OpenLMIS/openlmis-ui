export type QueueTransport = { userId: string };
export class QueueNotSentError extends Error {
  constructor() {
    super('The queued event was not sent because its session is unavailable.');
    this.name = 'QueueNotSentError';
  }
}

export class QueueReceiptError extends Error {
  constructor(public readonly response: { status: number; data: unknown }) {
    super('The original owner must save this queue receipt after its session changed.');
    this.name = 'QueueReceiptError';
  }
}
