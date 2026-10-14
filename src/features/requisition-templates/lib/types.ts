export type ColumnSource =
  | 'USER_INPUT'
  | 'CALCULATED'
  | 'REFERENCE_DATA'
  | 'STOCK_CARDS'
  | 'PREVIOUS_REQUISITION'
  | 'SUPPLYING_FACILITY_STOCK';

export type ColumnOption = {
  id: string;
  optionName: string;
  optionLabel: string;
};

export type ColumnDefinition = {
  id: string;
  name: string;
  label: string;
  indicator: string;
  definition: string;
  canChangeOrder: boolean;
  columnType: 'NUMERIC' | 'TEXT' | 'BOOLEAN' | 'CURRENCY';
  mandatory: boolean;
  isDisplayRequired: boolean;
  canBeChangedByUser: boolean;
  supportsTag: boolean;
  sources: readonly ColumnSource[];
  options: readonly ColumnOption[];
};

export type TemplateColumn = {
  name: string;
  label: string;
  indicator: string;
  definition: string;
  displayOrder: number;
  isDisplayed: boolean;
  source: ColumnSource;
  option?: ColumnOption | null;
  tag?: string | null;
  columnDefinition: ColumnDefinition;
};

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
  numberOfPeriodsToAverage: number;
  enableAvgConsumptionForCurrentPeriod?: boolean;
  columnsMap: Record<string, TemplateColumn>;
};

export type NewRequisitionTemplate = Omit<RequisitionTemplate, 'id'>;
