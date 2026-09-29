import Dexie from 'dexie';
import { useLoginData } from '@/features/auth/store/login-data';

type DatabaseOwner = {
  deployment: string;
  userId: string;
};

export const localDatabaseName = ({ deployment, userId }: DatabaseOwner) =>
  `openlmis-ui:${deployment}:${userId}`;

function deployment() {
  const server = (import.meta.env.DEV && import.meta.env.VITE_API_PROXY_TARGET) || location.origin;
  return `${server}${import.meta.env.BASE_URL}`;
}

let database: Dexie | null = null;

export function getLocalDb(): Dexie {
  const userId = useLoginData.getState().referenceDataUserId;
  if (!userId) throw new Error('No one is signed in, so there is no local database to open.');

  if (!database) {
    database = new Dexie(localDatabaseName({ deployment: deployment(), userId }));
    database.version(1).stores({});
  }
  return database;
}

useLoginData.subscribe((state, previous) => {
  if (state.referenceDataUserId === previous.referenceDataUserId) return;
  database?.close();
  database = null;
});
