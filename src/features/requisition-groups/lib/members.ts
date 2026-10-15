import { z } from 'zod';
import type { MemberFacility } from '@/features/requisition-groups/lib/types';
import { tableSearchSchema, textFilterSchema } from '@/lib/table-search';
import { fold } from '@/lib/text';

const MEMBER_SORT_FIELDS = ['name', 'zone', 'type', 'enabled'] as const;
export const requisitionGroupEditorSearchSchema = tableSearchSchema(MEMBER_SORT_FIELDS).extend({
  tab: z.literal('facilities').optional().catch(undefined),
  q: textFilterSchema,
});
export type RequisitionGroupEditorSearch = z.infer<typeof requisitionGroupEditorSearchSchema>;
export const DEFAULT_MEMBER_SORT = { id: 'name', desc: false };
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const value = (row: MemberFacility, key: (typeof MEMBER_SORT_FIELDS)[number]) => {
  if (key === 'zone') return row.geographicZone?.name ?? '';
  if (key === 'type') return row.type?.name ?? '';
  if (key === 'enabled') return String(row.enabled);
  return row.name;
};
export function memberPage(rows: readonly MemberFacility[], search: RequisitionGroupEditorSearch) {
  const term = fold(search.q?.trim() ?? '');
  const field = search.sort ?? 'name';
  const matching = rows
    .filter((row) => !term || fold(row.name).includes(term))
    .sort((a, b) => {
      const order = collator.compare(value(a, field), value(b, field));
      return (
        (search.dir === 'desc' ? -order : order) ||
        collator.compare(a.name, b.name) ||
        a.id.localeCompare(b.id)
      );
    });
  const size = search.size ?? 10;
  const page = Math.min(search.page ?? 1, Math.max(1, Math.ceil(matching.length / size)));
  return { data: matching.slice((page - 1) * size, page * size), total: matching.length, page };
}
