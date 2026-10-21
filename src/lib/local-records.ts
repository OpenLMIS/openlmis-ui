import type { IndexableType } from 'dexie';
import {
  getLocalDb,
  getLocalDbUserId,
  type LocalTableName,
  localTable,
} from '@/integrations/local-db';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

type OwnedRecord = { userId: string; formatVersion: number };
type ReadOptions<T> = { formats: readonly number[]; accept?: (record: T) => boolean };

export async function readOwnedRecord<T extends OwnedRecord>(
  table: LocalTableName,
  key: IndexableType,
  { formats, accept }: ReadOptions<T>,
): Promise<T | undefined> {
  const scope = getSessionScope();
  const userId = getLocalDbUserId();
  const record = await localTable<T>(table).get(key);
  assertSessionScope(scope);
  return record &&
    record.userId === userId &&
    formats.includes(record.formatVersion) &&
    (!accept || accept(record))
    ? record
    : undefined;
}

export async function requireOwnedRecord<T extends OwnedRecord>(
  table: LocalTableName,
  key: IndexableType,
  options: ReadOptions<T>,
): Promise<T> {
  const record = await readOwnedRecord(table, key, options);
  if (!record) throw new LocalDataUnavailableError();
  return record;
}

export async function putOwnedRecord<T extends OwnedRecord>(
  name: LocalTableName,
  record: T,
  check: () => void = () => {},
) {
  const scope = getSessionScope();
  const userId = getLocalDbUserId();
  const table = localTable<T>(name);
  const assertOwner = () => {
    assertSessionScope(scope);
    check();
    if (record.userId !== userId) throw new LocalDataUnavailableError();
  };
  await getLocalDb().transaction('rw', table, async () => {
    assertOwner();
    await table.put(record);
    assertOwner();
  });
  assertOwner();
}
