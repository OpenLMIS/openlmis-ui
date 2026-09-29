import Dexie from 'dexie';
import { useLoginData } from '@/features/auth/store/login-data';

type DatabaseOwner = {
  /** Where the data came from: the origin and base path, or the API a dev server proxies to. */
  deployment: string;
  userId: string;
};

/** One database per deployment and user, so no one ever opens another user's data. */
export const localDatabaseName = ({ deployment, userId }: DatabaseOwner) =>
  `openlmis-ui:${deployment}:${userId}`;

function deployment() {
  // One `localhost` can point at different servers in dev, which are different deployments.
  const server = (import.meta.env.DEV && import.meta.env.VITE_API_PROXY_TARGET) || location.origin;
  return `${server}${import.meta.env.BASE_URL}`;
}

let database: Dexie | null = null;

/** The signed-in user's database; screens declare their own tables in later versions. */
export function getLocalDb(): Dexie {
  const userId = useLoginData.getState().referenceDataUserId;
  if (!userId) throw new Error('No one is signed in, so there is no local database to open.');

  // A user change clears it below, so a database left open always belongs to this user.
  if (!database) {
    database = new Dexie(localDatabaseName({ deployment: deployment(), userId }));
    database.version(1).stores({});
  }
  return database;
}

// A sign out, or someone else signing in, closes the last user's database; its data stays theirs.
useLoginData.subscribe((state, previous) => {
  if (state.referenceDataUserId === previous.referenceDataUserId) return;
  database?.close();
  database = null;
});
