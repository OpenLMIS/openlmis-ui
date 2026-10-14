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

export function getLocalDbUserId() {
  const userId = useLoginData.getState().referenceDataUserId;
  if (!userId) throw new Error('No one is signed in, so there is no local database to open.');
  return userId;
}

export function getLocalDb(): Dexie {
  const userId = getLocalDbUserId();

  if (!database) {
    database = new Dexie(localDatabaseName({ deployment: deployment(), userId }));
    database.version(1).stores({});
    database.version(2).stores({ physicalInventoryDrafts: 'draftId' });
    database.version(3).stores({
      offlineAccess: 'userId',
      adjustmentDownloads: '[facilityId+programId]',
    });
    database.version(4).stores({
      stockEventDrafts: 'draftId, [kind+facilityId+programId+state], updatedAt',
    });
    const name = database.name;
    database
      .version(5)
      .stores({
        stockEventQueue: '++sequence, &localEventId, draftId, [status+sequence]',
        stockEventSyncErrors: '&localEventId, [facilityId+programId], failedAt',
        stockEventReceipts: '[draftId+revision], &localEventId, serverEventId',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table('stockEventDrafts')
          .toCollection()
          .modify((draft) => {
            const key = `${name}:stock-event-accepted:${draft.draftId}`;
            let accepted = draft.submissionAccepted || draft.state === 'accepted';
            try {
              accepted ||= localStorage.getItem(key) === 'accepted';
              localStorage.removeItem(key);
            } catch {
              // Retain the IndexedDB state when legacy marker cleanup is unavailable.
            }
            if (accepted) draft.state = 'accepted';
            delete draft.submissionAttempted;
            delete draft.submissionAccepted;
            draft.localEventId ??= crypto.randomUUID();
          });
      });
  }
  return database;
}

useLoginData.subscribe((state, previous) => {
  if (state.referenceDataUserId === previous.referenceDataUserId) return;
  database?.close();
  database = null;
});
