import type { ParseKeys } from 'i18next';
import { apiFieldMessages, keyedApiErrorText } from '@/lib/api-error';

const fallback = 'requisition-templates.form.save-error';

export function templateFieldErrors(error: unknown, t: (key: ParseKeys) => string) {
  const fields = new Map<string, string>();
  for (const { field, key, message } of apiFieldMessages(error)) {
    let text: string | undefined;
    if (field === 'numberOfPeriodsToAverage') {
      if (key === 'requisition.error.validation.fieldMustBeGreaterOrEqual') {
        text = t('requisition-templates.configure.validation.periods-minimum');
      } else if (key === 'requisition.error.validation.fieldCanNotBeNull') {
        text = t('requisition-templates.configure.validation.periods-required');
      }
    }
    fields.set(field, text ?? keyedApiErrorText(key, message, t) ?? t(fallback));
  }
  if (!fields.size) return undefined;
  const program = fields.get('programId');
  const periods = fields.get('numberOfPeriodsToAverage');
  const facilityTypes = fields.get('facilityTypeId');
  const columns = fields.get('columnsMap');
  for (const field of ['programId', 'numberOfPeriodsToAverage', 'facilityTypeId', 'columnsMap']) {
    fields.delete(field);
  }
  return { program, periods, facilityTypes, columns, general: [...fields.values()].join(' ') };
}
