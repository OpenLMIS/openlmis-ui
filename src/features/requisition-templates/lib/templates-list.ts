import { programName } from '@/features/reference-data/lib/programs';
import type { Program } from '@/features/reference-data/lib/types';
import type { RequisitionTemplate } from '@/features/requisition-templates/lib/types';

export function groupTemplatesByProgram<T extends Pick<RequisitionTemplate, 'name' | 'program'>>(
  programs: readonly Program[],
  templates: readonly T[],
) {
  return programs
    .toSorted((a, b) => programName(a).localeCompare(programName(b)))
    .map((program) => ({
      program,
      templates: templates
        .filter((template) => template.program?.id === program.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
