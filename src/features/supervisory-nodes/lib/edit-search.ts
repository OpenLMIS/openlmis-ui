import { z } from 'zod';
import { tableSearchSchema } from '@/lib/table-search';

const { page, size } = tableSearchSchema(['name']).shape;
const editPage = page.transform((value) => (value === 1 ? undefined : value));
const editSize = size.transform((value) => (value === 10 ? undefined : value));
export const nodeEditSearchSchema = z.object({
  childPage: editPage,
  childSize: editSize,
  partnerPage: editPage,
  partnerSize: editSize,
  add: z.enum(['child', 'partner']).optional().catch(undefined),
});
export type NodeEditSearch = z.infer<typeof nodeEditSearchSchema>;
