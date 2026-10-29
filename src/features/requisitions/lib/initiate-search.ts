import { z } from 'zod';
import { facilityProgramSearchSchema } from '@/lib/facility-program-selection';

export const initiateSearchSchema = facilityProgramSearchSchema.extend({
  emergency: z.boolean().optional().catch(undefined),
});
export type InitiateSearch = z.infer<typeof initiateSearchSchema>;
export type RequisitionReturn = { to: '/requisitions/initiate'; search: InitiateSearch };

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: router types extend by interface merging.
  interface HistoryState {
    requisitionReturn?: RequisitionReturn;
  }
}
