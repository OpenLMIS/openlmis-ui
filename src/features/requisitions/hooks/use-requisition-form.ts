import { useEffect, useMemo, useRef } from 'react';
import { useAppForm } from '@/components/form/form';
import type { QuantityValue } from '@/components/form/quantity-value';
import { useRequisitionDraft } from '@/features/requisitions/hooks/use-requisition-draft';
import {
  buildRequisitionDraft,
  type LineDraft,
  type RequisitionDraft,
} from '@/features/requisitions/lib/draft';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

export function useRequisitionForm(record: RequisitionRecord) {
  const adopt = useRef<(draft: RequisitionDraft) => void>(() => {});
  const device = useRequisitionDraft(record, (draft) => adopt.current(draft));
  const staged = useRef<RequisitionDraft | undefined>(undefined);
  const form = useAppForm({
    defaultValues: {
      draft: buildRequisitionDraft(record),
      quantities: {} as Record<string, QuantityValue>,
      texts: {} as Record<string, string>,
      showAllErrors: false,
    },
  });
  staged.current ??= form.state.values.draft;
  adopt.current = (draft) => {
    staged.current = draft;
    form.reset({ draft, quantities: {}, texts: {}, showAllErrors: false });
  };
  const write = useRef(device.write);
  write.current = device.write;
  useEffect(() => {
    const subscription = form.store.subscribe(() => {
      const draft = form.state.values.draft;
      if (staged.current !== draft) {
        staged.current = draft;
        write.current(draft);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);
  const latestDevice = useRef(device);
  latestDevice.current = device;
  return useMemo(
    () => ({
      form,
      get draft() {
        return form.state.values.draft;
      },
      get device() {
        return latestDevice.current;
      },
      resolveConflict(choice: 'load' | 'copy') {
        return latestDevice.current.resolve(choice, form.state.values.draft);
      },
      setLine(id: string, changes: LineDraft) {
        if (latestDevice.current.outdated || latestDevice.current.status.status === 'loading')
          return;
        form.setFieldValue('draft.lines', (lines) => ({
          ...lines,
          [id]: { ...lines[id], ...changes },
        }));
      },
      setLines(ids: string[], changes: LineDraft) {
        if (latestDevice.current.outdated || latestDevice.current.status.status === 'loading')
          return;
        form.setFieldValue('draft.lines', (lines) => {
          const next = { ...lines };
          for (const id of ids) next[id] = { ...lines[id], ...changes };
          return next;
        });
      },
      removeLine(id: string) {
        if (latestDevice.current.outdated || latestDevice.current.status.status === 'loading')
          return;
        form.setFieldValue('draft.removedLineIds', (ids) =>
          ids.includes(id) ? ids : [...ids, id],
        );
      },
    }),
    [form],
  );
}
export type RequisitionEditor = ReturnType<typeof useRequisitionForm>;
