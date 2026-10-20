import type { QueueTransport } from '@/lib/queue-transport';
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

export const stockEventTransport = (userId: string): QueueTransport => ({
  userId,
  notSent: () => new QueueNotSentError(),
  receipt: (response) => new QueueReceiptError(response),
});
