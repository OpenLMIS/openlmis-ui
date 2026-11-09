import { useState } from 'react';
import { useOnline } from '@/lib/online';
import { useSessionScope } from '@/lib/session-scope';

export function useListConnection(search: object, refresh = 0) {
  const online = useOnline();
  const session = useSessionScope();
  const key = JSON.stringify([session, search, refresh]);
  const [source, setSource] = useState({ key, online });
  if (source.key !== key || (online && !source.online)) {
    setSource({ key, online });
    return online;
  }
  return source.online;
}
