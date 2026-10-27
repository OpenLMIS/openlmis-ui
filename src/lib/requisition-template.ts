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

export type TemplateColumnDefinition = Pick<
  ColumnDefinition,
  'id' | 'name' | 'canChangeOrder' | 'isDisplayRequired' | 'supportsTag' | 'sources' | 'options'
>;

export type TemplateColumn = {
  name: string;
  label: string;
  indicator: string;
  definition: string | null | undefined;
  displayOrder: number;
  isDisplayed: boolean;
  source: ColumnSource | null;
  option?: ColumnOption | null;
  tag?: string | null;
  columnDefinition: TemplateColumnDefinition;
};

export type RequisitionColumn = Pick<
  TemplateColumn,
  'name' | 'label' | 'displayOrder' | 'isDisplayed' | 'source'
> & {
  indicator?: TemplateColumn['indicator'];
  definition?: TemplateColumn['definition'];
  option?: Pick<ColumnOption, 'optionName'> | null;
  columnDefinition?: Pick<ColumnDefinition, 'columnType'>;
};
