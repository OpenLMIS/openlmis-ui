import type { ReportTemplate, ReportTemplateParameter } from '@/features/reports/lib/types';

/** A template parameter as the report services return it, with every unused field null. */
export const reportParameter = (
  fields: Pick<ReportTemplateParameter, 'name'> & Partial<ReportTemplateParameter>,
): ReportTemplateParameter => ({
  id: null,
  displayName: fields.name,
  defaultValue: null,
  dataType: 'java.lang.String',
  selectExpression: null,
  selectMethod: null,
  selectBody: null,
  selectProperty: null,
  displayProperty: null,
  description: null,
  required: false,
  displayOrder: null,
  options: [],
  dependencies: [],
  ...fields,
});

const lookup = (path: string, property: string, display: string | null = property) => ({
  selectExpression: path,
  selectProperty: property,
  displayProperty: display,
});

/** The six templates on the test server (16 November 2026), parameters in their returned order. */
export const STOCK_ON_HAND: ReportTemplate = {
  id: 'soh',
  name: 'Stock On Hand',
  description: 'Report on information about stock on hand of products',
  requiredRights: null,
  templateParameters: [
    reportParameter({
      name: 'date',
      displayName: 'Date',
      description: 'datepickers',
      required: true,
    }),
    reportParameter({
      name: 'facility',
      displayName: 'Facility',
      ...lookup('/api/facilities', 'name'),
    }),
    reportParameter({
      name: 'expiredProducts',
      displayName: 'Expired Products',
      description: 'booleanSelect',
    }),
    reportParameter({
      name: 'facilityType',
      displayName: 'Facility Type',
      ...lookup('/api/facilityTypes', 'name'),
    }),
    reportParameter({
      name: 'geographicZone',
      displayName: 'Geographic Zone',
      selectMethod: 'POST',
      ...lookup('/api/geographicZones/search', 'name'),
    }),
    reportParameter({
      name: 'program',
      displayName: 'Program',
      ...lookup('/api/programs', 'name'),
    }),
    reportParameter({
      name: 'product',
      displayName: 'Product',
      ...lookup('/api/orderables', 'fullProductName'),
    }),
  ],
};

export const FACILITY_ASSIGNMENT: ReportTemplate = {
  id: 'fa',
  name: 'Facility Assignment Configuration Errors',
  requiredRights: null,
  templateParameters: [],
};

export const PERIODIC_SUMMARY: ReportTemplate = {
  id: 'summary',
  name: 'Periodic Stock On Hand Summary',
  requiredRights: null,
  templateParameters: [
    reportParameter({
      name: 'startDate',
      displayName: 'Start Date',
      description: 'datepickers',
      required: true,
    }),
    reportParameter({
      name: 'endDate',
      displayName: 'End Date',
      description: 'datepickers',
      required: true,
    }),
    reportParameter({
      name: 'facility',
      displayName: 'Facility',
      required: true,
      ...lookup('/api/facilities', 'name'),
    }),
    reportParameter({
      name: 'program',
      displayName: 'Program',
      description: '',
      required: true,
      ...lookup('/api/programs', 'name'),
    }),
    reportParameter({
      name: 'product',
      displayName: 'Product',
      ...lookup('/api/orderables', 'fullProductName'),
    }),
  ],
};

export const SAMPLE_REQUISITION: ReportTemplate = {
  id: 'sample',
  name: 'Sample Requisition Report',
  templateParameters: [
    reportParameter({
      name: 'Program',
      displayName: 'Program Name',
      required: true,
      ...lookup('/api/programs', 'name', null),
    }),
  ],
};

export const TIMELINESS: ReportTemplate = {
  id: 'timeliness',
  name: 'Timeliness Report',
  templateParameters: [
    reportParameter({
      name: 'district',
      displayName: 'District',
      dataType: 'org.openlmis.requisition.dto.GeographicZoneDto',
      selectMethod: 'POST',
      selectBody: '{"levelNumber": "3"}',
      ...lookup('/api/geographicZones/search', 'id', 'name'),
    }),
    reportParameter({
      name: 'program',
      displayName: 'Program Name',
      dataType: 'org.openlmis.requisition.dto.ProgramDto',
      required: true,
      ...lookup('/api/programs', 'id', 'name'),
    }),
    reportParameter({
      name: 'period',
      displayName: 'Period Name',
      dataType: 'org.openlmis.requisition.dto.ProcessingPeriodDto',
      required: true,
      dependencies: [{ id: 'dep', dependency: 'program', placeholder: 'programId' }],
      ...lookup('/api/processingPeriods', 'id', 'name'),
    }),
  ],
};

export const REPORTING_RATE: ReportTemplate = {
  id: 'rate',
  name: 'Reporting Rate Report',
  templateParameters: [
    reportParameter({
      name: 'GeographicZone',
      displayName: 'Geographic Zone',
      selectMethod: 'POST',
      selectBody: '{"levelNumber": "2"}',
      ...lookup('/api/geographicZones/search', 'id', 'name'),
    }),
    reportParameter({
      name: 'Program',
      displayName: 'Program',
      required: true,
      ...lookup('/api/programs', 'id', 'name'),
    }),
    reportParameter({
      name: 'Period',
      displayName: 'Processing Period',
      required: true,
      ...lookup('/api/processingPeriods', 'id', 'name'),
    }),
    reportParameter({
      name: 'DueDays',
      displayName: 'Due date (days)',
      dataType: 'java.lang.Integer',
    }),
  ],
};
