import { create } from 'zustand';
import { getSessionScope } from '@/lib/session-scope';

export function createScopedAnnouncement<T>() {
  const useStore = create<{ current: { value: T; scope: number } | null }>(() => ({
    current: null,
  }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    announce(value: T) {
      clearTimeout(timer);
      useStore.setState({ current: { value, scope: getSessionScope() } });
      timer = setTimeout(() => useStore.setState({ current: null }), 4000);
    },
    useAnnouncement: () =>
      useStore(({ current }) => (current?.scope === getSessionScope() ? current.value : null)),
  };
}
