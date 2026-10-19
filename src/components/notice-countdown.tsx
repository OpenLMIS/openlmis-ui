import { type CSSProperties, useEffect, useRef, useSyncExternalStore } from 'react';
import type { NoticeCountdown } from '@/lib/notice-countdown';

export function NoticeCountdownBar({ countdown }: { countdown: NoticeCountdown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const alert = ref.current?.closest('[data-slot=alert]');
    if (alert?.matches(':hover')) countdown.pause('hover', true);
    if (alert?.contains(document.activeElement)) countdown.pause('focus', true);
    return () => {
      countdown.pause('hover', false);
      countdown.pause('focus', false);
    };
  }, [countdown]);
  const state = useSyncExternalStore(countdown.subscribe, countdown.getSnapshot);
  const remaining = countdown.remaining();
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-lg"
    >
      <div
        key={state.revision}
        className="notice-countdown h-full bg-current"
        style={
          {
            '--notice-progress-start': `${(remaining / state.duration) * 100}%`,
            '--notice-duration': `${remaining}ms`,
            '--notice-play-state': state.paused ? 'paused' : 'running',
          } as CSSProperties
        }
      />
    </div>
  );
}
