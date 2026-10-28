import { useStore } from '@tanstack/react-form';
import { useEffect, useRef } from 'react';
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
    },
  });
  staged.current ??= form.state.values.draft;
  adopt.current = (draft) => {
    staged.current = draft;
    form.reset({ draft, quantities: {}, texts: {} });
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
  const draft = useStore(form.store, (state) => state.values.draft);
  return {
    form,
    draft,
    device,
    setLine(id: string, changes: LineDraft) {
      if (device.outdated || device.status.status === 'loading') return;
      form.setFieldValue('draft.lines', (lines) => ({
        ...lines,
        [id]: { ...lines[id], ...changes },
      }));
    },
    removeLine(id: string) {
      if (device.outdated || device.status.status === 'loading') return;
      form.setFieldValue('draft.removedLineIds', (ids) => (ids.includes(id) ? ids : [...ids, id]));
    },
  };
}
export type RequisitionEditor = ReturnType<typeof useRequisitionForm>;
