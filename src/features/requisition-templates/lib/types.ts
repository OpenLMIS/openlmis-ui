import type { TemplateColumn } from '@/lib/requisition-template';

export type RequisitionTemplate = {
  id: string;
  createdDate?: string;
  modifiedDate?: string;
  name: string;
  program: { id: string; href?: string } | null;
  facilityTypes: { id: string; href?: string }[];
  requisitionReportOnly: boolean;
  populateStockOnHandFromStockCards: boolean;
  rejectionReasonWindowVisible: boolean;
  patientsTabEnabled: boolean;
  numberOfPeriodsToAverage: number | null;
  enableAvgConsumptionForCurrentPeriod?: boolean;
  columnsMap: Record<string, TemplateColumn>;
};

export type NewRequisitionTemplate = Omit<RequisitionTemplate, 'id'>;
