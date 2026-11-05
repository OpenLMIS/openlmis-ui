import {
  applyRequisitionDraft,
  type RequisitionDraft,
  rebaseRequisitionDraft,
} from '@/features/requisitions/lib/draft';
import { type PatientDisease, parsePatients } from '@/features/requisitions/lib/patients';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

export type DraftBaseValues = Record<string, unknown>;
export type DraftFieldConflict = { path: string; yours: unknown; server: unknown };
const equal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function fields(record: RequisitionRecord): DraftBaseValues {
  const result: DraftBaseValues = {
    draftStatusMessage: record.draftStatusMessage ?? '',
    datePhysicalStockCountCompleted: record.datePhysicalStockCountCompleted ?? null,
  };
  for (const line of record.requisitionLineItems) {
    result[`removedLineIds/${line.id}`] = line;
    for (const [key, value] of Object.entries(line)) result[`lines/${line.id}/${key}`] = value;
  }
  return result;
}
function edits(record: RequisitionRecord, draft: RequisitionDraft) {
  const attempted = fields(applyRequisitionDraft(record, draft));
  const result: DraftBaseValues = {};
  for (const [id, values] of Object.entries(draft.lines))
    for (const key of Object.keys(values))
      result[`lines/${id}/${key}`] = attempted[`lines/${id}/${key}`];
  for (const key of ['draftStatusMessage', 'datePhysicalStockCountCompleted'] as const)
    result[key] = draft[key];
  for (const id of draft.removedLineIds) result[`removedLineIds/${id}`] = null;
  for (const line of draft.addedLines) result[`addedLines/${line.id}`] = line;
  if (draft.patients) {
    const patients = parsePatients(applyRequisitionDraft(record, draft).patientsData);
    for (const [id, change] of Object.entries(draft.patients)) {
      const [disease, key] = id.split(':');
      const row = patients[disease as PatientDisease]?.[0]?.find(
        (r: { key: string }) => r.key === key,
      );
      if (change.skipped !== undefined) result[`patients/${id}/skipped`] = row?.isSkipped;
      for (const month of Object.keys(change.values ?? {}))
        result[`patients/${id}/values/${month}`] = row?.data[Number(month)]?.value;
    }
  }
  return result;
}
function serverFields(record: RequisitionRecord, paths: string[]) {
  const result = fields(record);
  const patients = parsePatients(record.patientsData);
  for (const path of paths) {
    const [kind, id, key, month] = path.split('/');
    if (kind === 'patients') {
      const [disease, rowKey] = id.split(':');
      const row = patients[disease as PatientDisease]?.[0]?.find(
        (r: { key: string }) => r.key === rowKey,
      );
      result[path] = key === 'skipped' ? row?.isSkipped : row?.data[Number(month)]?.value;
    }
    if (kind === 'addedLines')
      result[path] = record.requisitionLineItems.find((line) => line.id === id);
  }
  return result;
}
export function draftBaseValues(
  record: RequisitionRecord,
  draft: RequisitionDraft,
): DraftBaseValues {
  const changes = edits(record, draft);
  const base = serverFields(record, Object.keys(changes));
  return Object.fromEntries([
    ...Object.keys(changes).map((key) => [key, base[key] ?? null]),
    ...Object.keys(draft.lines).map((id) => [
      `removedLineIds/${id}`,
      base[`removedLineIds/${id}`] ?? null,
    ]),
  ]);
}
export function mergeRequisitionDraft(
  fresh: RequisitionRecord,
  draft: RequisitionDraft,
  base: DraftBaseValues,
  original = fresh,
  choices: Record<string, 'yours' | 'server'> = {},
  attempted?: RequisitionRecord,
) {
  const source = {
    ...original,
    requisitionLineItems: [
      ...original.requisitionLineItems,
      ...Object.keys(draft.lines).flatMap((id) => {
        const line = base[`removedLineIds/${id}`] as
          | RequisitionRecord['requisitionLineItems'][number]
          | undefined;
        return line && !original.requisitionLineItems.some((current) => current.id === id)
          ? [line]
          : [];
      }),
    ],
  };
  const changes = edits(source, draft);
  const server = serverFields(fresh, Object.keys(changes));
  const accepted = attempted ? serverFields(attempted, Object.keys(changes)) : undefined;
  const next = structuredClone(draft);
  const conflicts: DraftFieldConflict[] = [];
  for (const [path, yours] of Object.entries(changes)) {
    const current = server[path] ?? null;
    const before = accepted && equal(accepted[path], current) ? current : (base[path] ?? null);
    const changed = !equal(yours, before);
    const [kind, id, key, month] = path.split('/');
    const missingLine =
      kind === 'lines' && !fresh.requisitionLineItems.some((line) => line.id === id);
    const conflict =
      changed && (missingLine || (!equal(current, before) && !equal(current, yours)));
    if (conflict && !choices[path]) conflicts.push({ path, yours, server: current });
    const keep = changed && choices[path] !== 'server';
    if (missingLine && keep && !next.addedLines.some((line) => line.id === id)) {
      const previous =
        original.requisitionLineItems.find((line) => line.id === id) ??
        (base[`removedLineIds/${id}`] as
          | RequisitionRecord['requisitionLineItems'][number]
          | undefined);
      if (previous) next.addedLines.push(previous);
    }
    if (kind === 'lines' && !keep)
      delete next.lines[id]?.[key as keyof (typeof next.lines)[string]];
    if (kind === 'patients' && !keep) {
      if (key === 'skipped' && next.patients?.[id]) delete next.patients[id].skipped;
      else if (next.patients?.[id]?.values) delete next.patients[id].values[Number(month)];
    }
    if (kind === 'removedLineIds' && !keep)
      next.removedLineIds = next.removedLineIds.filter((value) => value !== id);
    if (kind === 'addedLines' && !keep)
      next.addedLines = next.addedLines.filter((value) => value.id !== id);
    if (kind === 'draftStatusMessage' && !keep)
      next.draftStatusMessage = fresh.draftStatusMessage ?? '';
    if (kind === 'datePhysicalStockCountCompleted' && !keep)
      next.datePhysicalStockCountCompleted = fresh.datePhysicalStockCountCompleted ?? null;
  }
  return { draft: rebaseRequisitionDraft(fresh, next), conflicts };
}
