import { type RefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EventForm } from '@/features/stock-events/hooks/use-event-form';
import type { useStockEventAutosave } from '@/features/stock-events/hooks/use-stock-event-autosave';
import type { EventKindConfig } from '@/features/stock-events/lib/event-kinds';
import { useDiscardGuard } from '@/hooks/use-discard-guard';

export function useDeviceDrafts({
  config,
  draft,
  form,
  canViewStock,
  ready,
  cardsLoaded,
  pending: posting,
  submitted,
  leaving,
  online,
  isCurrent,
  onCleared,
}: {
  config: EventKindConfig;
  draft: ReturnType<typeof useStockEventAutosave>;
  form: EventForm;
  canViewStock: boolean;
  ready: boolean;
  cardsLoaded: boolean;
  pending: boolean;
  submitted: boolean;
  leaving: RefObject<boolean>;
  online: boolean;
  isCurrent: () => boolean;
  onCleared: () => void;
}) {
  const { t } = useTranslation();
  const enabled = config.drafts === 'device';
  const [discarding, setDiscarding] = useState(false);
  const pending = posting || (enabled && canViewStock && (draft.loading || draft.busy));
  const guard = useDiscardGuard(
    (enabled ? draft.protected : form.state.values.lines.length > 0) && !submitted,
    {
      allowLeave: () => leaving.current,
      pending: !draft.readFailed && pending,
      flushBeforeLeave: enabled ? draft.flush : undefined,
    },
  );
  return {
    enabled,
    pending,
    ready: ready && (!enabled || config.products.from !== 'stock-cards' || cardsLoaded),
    submitLabel:
      enabled && !online
        ? ('stock-events.submit-offline' as const)
        : ('stock-events.submit' as const),
    leaveIfAsked: guard.leaveIfAsked,
    async clear(keys: Set<string>) {
      if (enabled) {
        const cleared = await draft.clear(keys);
        if (cleared && isCurrent() && !form.state.values.lines.length) onCleared();
      } else
        form.setFieldValue('lines', (current) => current.filter((line) => !keys.has(line.key)));
    },
    dialog: {
      ...guard.dialog,
      pending: discarding,
      title: enabled ? t('stock-events.draft-leave-title') : undefined,
      actionLabel: enabled
        ? t(guard.dialog.signingOut ? 'stock-events.draft-sign-out' : 'stock-events.draft-leave')
        : undefined,
      description: t(
        enabled
          ? guard.dialog.signingOut
            ? 'stock-events.draft-sign-out-description'
            : 'stock-events.draft-leave-description'
          : 'stock-events.discard-description',
      ),
      async onDiscard() {
        if (discarding) return;
        if (enabled && !guard.dialog.signingOut) {
          setDiscarding(true);
          const discarded = await draft.discard();
          if (!isCurrent()) return;
          setDiscarding(false);
          if (!discarded) {
            guard.dialog.onKeepEditing();
            return;
          }
        }
        guard.dialog.onDiscard();
      },
    },
  };
}
