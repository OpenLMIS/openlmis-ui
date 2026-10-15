import type { ParseKeys } from 'i18next';
import type { ColumnSource } from '@/features/requisition-templates/lib/types';

export const SOURCE_KEYS: Record<ColumnSource, ParseKeys> = {
  USER_INPUT: 'requisition-templates.configure.source.user-input',
  CALCULATED: 'requisition-templates.configure.source.calculated',
  REFERENCE_DATA: 'requisition-templates.configure.source.reference-data',
  STOCK_CARDS: 'requisition-templates.configure.source.stock-cards',
  PREVIOUS_REQUISITION: 'requisition-templates.configure.source.previous-requisition',
  SUPPLYING_FACILITY_STOCK: 'requisition-templates.configure.source.supplying-facility-stock',
};

export const OPTION_KEYS: Record<string, ParseKeys> = {
  disableSkippedLineItems: 'requisition-templates.configure.option.disable-skipped',
  hideSkippedLineItems: 'requisition-templates.configure.option.hide-skipped',
  showPackToShipInAllPages: 'requisition-templates.configure.option.all-pages',
  showPackToShipInApprovalPage: 'requisition-templates.configure.option.approval-page',
  dispensingUnitsForNewPatients: 'requisition-templates.configure.option.dispensing-unit',
  newPatientCount: 'requisition-templates.configure.option.patient-count',
  default: 'requisition-templates.configure.option.default',
};
