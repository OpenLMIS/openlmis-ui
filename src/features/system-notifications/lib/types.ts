export type SystemNotification = {
  id: string;
  title: string | null;
  message: string;
  author?: NotificationAuthor | null;
  active: boolean;
  startDate?: string | null;
  expiryDate?: string | null;
  createdDate?: string | null;
};

export type NotificationAuthor = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
};

export type NotificationsQuery = {
  page: number;
  size: number;
  expand: 'author';
  authorId?: string;
  isDisplayed?: true;
};

export type NotificationPayload = {
  author: { id: string };
  title: string | null;
  message: string;
  active: boolean;
  startDate: string | null;
  expiryDate: string | null;
};

export type SavedNotification = SystemNotification & {
  author: NotificationAuthor & { id: string };
  createdDate: string;
};

export type NotificationUpdate = NotificationPayload & { id: string; createdDate: string };
