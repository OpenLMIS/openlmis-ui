import { programName } from '@/features/reference-data/lib/programs';
import type { MinimalFacility, Program } from '@/features/reference-data/lib/types';

export const toProgramOption = (program: Pick<Program, 'id' | 'code' | 'name'>) => ({
  value: program.id,
  label: programName(program),
});

export const toFacilityOption = (facility: Pick<MinimalFacility, 'id' | 'code' | 'name'>) => ({
  value: facility.id,
  label: facility.name,
  description: facility.code,
});
