export type SystemNotification = {
  id: string;
  title: string | null;
  message: string;
  author?: { firstName?: string | null; lastName?: string | null } | null;
  createdDate?: string | null;
};
