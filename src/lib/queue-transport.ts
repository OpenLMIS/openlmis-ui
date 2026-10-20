export type QueueTransport = {
  userId: string;
  notSent: () => Error;
  receipt: (response: { status: number; data: unknown }) => Error;
};
