import { useEffect, useMemo, useRef } from 'react';
import { useAppForm } from '@/components/form/form';
import type { QuantityValue } from '@/components/form/quantity-value';
import { useRequisitionDraft } from '@/features/requisitions/hooks/use-requisition-draft';
import {
  buildRequisitionDraft,
  type LineDraft,
  type RequisitionDraft,
} from '@/features/requisitions/lib/draft';
import {
  applyPatientChanges,
  type PatientDisease,
  parsePatients,
  patientRowHasValues,
  rebasePatientChanges,
} from '@/features/requisitions/lib/patients';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

export function useRequisitionForm(record: RequisitionRecord) {
  const basePatients = useMemo(() => parsePatients(record.patientsData), [record.patientsData]);
  const adopt = useRef<(draft: RequisitionDraft) => void>(() => {});
  const device = useRequisitionDraft(record, (draft) => adopt.current(draft));
  const staged = useRef<RequisitionDraft | undefined>(undefined);
  const defaults = useRef({
    draft: buildRequisitionDraft(record),
    quantities: {} as Record<string, QuantityValue>,
    texts: {} as Record<string, string>,
    showAllErrors: false,
  });
  const form = useAppForm({ defaultValues: defaults.current });
  staged.current ??= form.state.values.draft;
  adopt.current = (draft) => {
    staged.current = draft;
    defaults.current = { draft, quantities: {}, texts: {}, showAllErrors: false };
    form.reset(defaults.current);
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
      resolveConflict() {
        return latestDevice.current.resolve();
      },
      get locked() {
        return latestDevice.current.outdated || latestDevice.current.status.status === 'loading';
      },
      setLine(id: string, changes: LineDraft) {
        this.setLines([id], changes);
      },
      setLines(ids: string[], changes: LineDraft) {
        if (this.locked) return;
        form.setFieldValue('draft.lines', (lines) => {
          const next = { ...lines };
          for (const id of ids) next[id] = { ...lines[id], ...changes };
          return next;
        });
      },
      setPatientValue(disease: PatientDisease, key: string, month: number, text: string) {
        if (this.locked) return;
        form.setFieldValue('draft.patients', (changes) => {
          const id = `${disease}:${key}`;
          const next = {
            ...changes,
            [id]: { ...changes?.[id], values: { ...changes?.[id]?.values, [month]: text } },
          };
          return rebasePatientChanges(basePatients, next);
        });
      },
      setPatientSkip(disease: PatientDisease, key: string, skipped: boolean) {
        if (this.locked) return;
        form.setFieldValue('draft.patients', (changes) => {
          const data = applyPatientChanges(basePatients, changes);
          const row = data[disease][0].find((row) => row.key === key);
          if (!row || (skipped && patientRowHasValues(row))) return changes;
          const id = `${disease}:${key}`;
          return rebasePatientChanges(basePatients, {
            ...changes,
            [id]: { ...changes?.[id], skipped },
          });
        });
      },
      removeLine(id: string) {
        if (this.locked) return;
        form.setFieldValue('draft.removedLineIds', (ids) =>
          ids.includes(id) ? ids : [...ids, id],
        );
      },
    }),
    [form, basePatients],
  );
}
export type RequisitionEditor = ReturnType<typeof useRequisitionForm>;
