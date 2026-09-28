import type { UserContactDetails, UserRecord } from '@/lib/user-types';

/** The user and their contact details; a user without contact details has `null`. */
export type Profile = {
  user: UserRecord;
  contact: UserContactDetails | null;
};

export type NotificationChannel = 'EMAIL' | 'SMS';

/** A kind of notification that can be gathered into a digest, e.g. `requisition-actionRequired`. */
export type DigestConfiguration = {
  id: string;
  tag: string;
  message?: string | null;
};

export type DigestSubscription = {
  digestConfiguration: { id: string };
  preferredChannel: NotificationChannel;
  useDigest: boolean;
  cronExpression?: string | null;
};
