import { z } from 'zod';
import type { SupervisoryNode } from '@/features/supervisory-nodes/lib/types';

export type DraftNode = { id: string; name?: string; code?: string; facilityId?: string | null };
export type NodeDraft = {
  code: string;
  name: string;
  description: string;
  facilityId: string | null;
  parentId: string | null;
  children: DraftNode[];
  partners: DraftNode[];
};

const requiredText = z.string().trim().min(1, 'supervisory-nodes.form.required');
export const nodeFormSchema = z.object({
  code: requiredText,
  name: requiredText,
  description: z.string(),
  facilityId: z.string().nullable(),
  parentId: z.string().nullable(),
  children: z.array(z.object({ id: z.string() })),
  partners: z.array(z.object({ id: z.string() })),
});

export function toDraft(node: SupervisoryNode): NodeDraft {
  return {
    code: node.code,
    name: node.name,
    description: node.description ?? '',
    facilityId: node.facility?.id ?? null,
    parentId: node.parentNode?.id ?? null,
    children: node.childNodes.map(({ id }) => ({ id })),
    partners: node.partnerNodes.map(({ id }) => ({ id })),
  };
}

type PickerNode = { id: string; name: string; facility?: { id: string } | null };
function toNodeOption(node: PickerNode, facilityNames: ReadonlyMap<string, string>) {
  const facility = node.facility && facilityNames.get(node.facility.id);
  return { value: node.id, label: facility ? `${node.name} (${facility})` : node.name };
}

function options(
  nodes: readonly PickerNode[],
  excluded: (string | null)[],
  facilityNames: ReadonlyMap<string, string>,
) {
  const ids = new Set(excluded);
  return nodes
    .filter(({ id }) => !ids.has(id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((node) => toNodeOption(node, facilityNames));
}
export function childOptions(
  nodes: readonly PickerNode[],
  selfId: string,
  rows: readonly DraftNode[],
  parentId: string | null,
  facilityNames: ReadonlyMap<string, string> = new Map(),
) {
  return options(nodes, [selfId, parentId, ...rows.map(({ id }) => id)], facilityNames);
}
export function parentOptions(
  nodes: readonly PickerNode[],
  selfId: string,
  rows: readonly DraftNode[],
  facilityNames: ReadonlyMap<string, string> = new Map(),
) {
  return options(nodes, [selfId, ...rows.map(({ id }) => id)], facilityNames);
}
export function partnerOptions(
  nodes: readonly PickerNode[],
  selfId: string,
  rows: readonly DraftNode[],
  facilityNames: ReadonlyMap<string, string> = new Map(),
) {
  return options(nodes, [selfId, ...rows.map(({ id }) => id)], facilityNames);
}

function mergeRefs(latest: DraftNode[], saved: DraftNode[], draft: DraftNode[]) {
  const draftIds = new Set(draft.map(({ id }) => id));
  const savedIds = new Set(saved.map(({ id }) => id));
  const removed = new Set(saved.filter(({ id }) => !draftIds.has(id)).map(({ id }) => id));
  const ids = new Set([
    ...latest.filter(({ id }) => !removed.has(id)).map(({ id }) => id),
    ...draft.filter(({ id }) => !savedIds.has(id)).map(({ id }) => id),
  ]);
  return [...ids].map((id) => ({ id }));
}

export type NodeBodyResult = { ok: true; body: SupervisoryNode } | { ok: false };
export function toNodeBody(
  latest: SupervisoryNode,
  saved: SupervisoryNode,
  draft: NodeDraft,
): NodeBodyResult {
  const initial = toDraft(saved);
  const parentId =
    draft.parentId !== initial.parentId ? draft.parentId : (latest.parentNode?.id ?? null);
  const children = mergeRefs(latest.childNodes, saved.childNodes, draft.children);
  if (parentId === latest.id || children.some(({ id }) => id === parentId)) return { ok: false };
  const facilityId =
    draft.facilityId !== initial.facilityId ? draft.facilityId : (latest.facility?.id ?? null);
  return {
    ok: true,
    body: {
      ...latest,
      code: (draft.code !== initial.code ? draft.code : latest.code).trim(),
      name: (draft.name !== initial.name ? draft.name : latest.name).trim(),
      description:
        (draft.description !== initial.description ? draft.description : latest.description) ||
        null,
      facility: facilityId ? { id: facilityId } : null,
      parentNode: parentId ? { id: parentId } : null,
      childNodes: children,
      partnerNodes: mergeRefs(latest.partnerNodes, saved.partnerNodes, draft.partners),
    },
  };
}
