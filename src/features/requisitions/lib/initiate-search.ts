import { z } from 'zod';
import { facilityProgramSearchSchema } from '@/lib/facility-program-selection';

export const initiateSearchSchema = facilityProgramSearchSchema.extend({
  emergency: z.boolean().optional().catch(undefined),
});
export type InitiateSearch = z.infer<typeof initiateSearchSchema>;
