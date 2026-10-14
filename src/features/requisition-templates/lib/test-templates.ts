import type {
  ColumnDefinition,
  RequisitionTemplate,
  TemplateColumn,
  TemplateColumnDefinition,
} from '@/features/requisition-templates/lib/types';

type CatalogRow = [
  string,
  string,
  string,
  string,
  string,
  ColumnDefinition['sources'],
  Partial<ColumnDefinition>,
];
const catalogRows: CatalogRow[] = [
  [
    '4a2e9fd3-1127-4b68-9912-84a5c00f6999',
    'requestedQuantity',
    'Requested quantity',
    'J',
    'Requested override of calculated quantity. This is quantified in dispensing units.',
    ['USER_INPUT'],
    {},
  ],
  [
    '33b2d2e9-3167-46b0-95d4-1295be9afc22',
    'beginningBalance',
    'Beginning balance',
    'A',
    'Based on the Stock On Hand from the previous period. This is quantified in dispensing units.',
    ['STOCK_CARDS', 'USER_INPUT'],
    {},
  ],
  [
    '752cda76-0db5-4b6e-bb79-0f531ab78e2c',
    'stockOnHand',
    'Stock on hand',
    'E',
    'Current physical count of stock on hand. This is quantified in dispensing units.',
    ['STOCK_CARDS', 'USER_INPUT', 'CALCULATED'],
    {},
  ],
  [
    '6b8d331b-a0dd-4a1f-aafb-40e6a72ab9f5',
    'requestedQuantityExplanation',
    'Requested quantity explanation',
    'W',
    'Explanation of request for a quantity other than calculated order quantity.',
    ['USER_INPUT'],
    {
      columnType: 'TEXT',
    },
  ],
  [
    '2ed8c74a-f424-4742-bd14-cfbe67b6e7be',
    'remarks',
    'Remarks',
    'L',
    'Any additional remarks.',
    ['USER_INPUT'],
    {
      columnType: 'TEXT',
    },
  ],
  [
    'a62a5fed-c0b6-4d49-8a96-c631da0d0113',
    'approvedQuantity',
    'Approved quantity',
    'K',
    'Final approved quantity. This is quantified in dispensing units.',
    ['USER_INPUT'],
    {},
  ],
  [
    '750b9359-c097-4612-8328-d21671f88920',
    'totalStockoutDays',
    'Total stockout days',
    'X',
    'Total number of days facility was out of stock.',
    ['STOCK_CARDS', 'USER_INPUT'],
    {},
  ],
  [
    'ef524868-9d0a-11e6-80f5-76304dec7eb7',
    'total',
    'Total',
    'Y',
    'Total of beginning balance and quantity received.',
    ['CALCULATED'],
    {},
  ],
  [
    'dc9dde56-593d-4929-81be-d1faec7025a8',
    'packsToShip',
    'Packs to ship',
    'V',
    'Total packs to be shipped based on pack size and applying rounding rules.',
    ['CALCULATED'],
    {
      options: [
        {
          id: 'dcf41f06-3000-4af6-acf5-5de4fffc966f',
          optionName: 'showPackToShipInAllPages',
          optionLabel: 'requisitionConstants.showPackToShipInAllPages',
        },
        {
          id: 'd1ff8f6f-5bbb-4b0e-8dd2-3835bfc03629',
          optionName: 'showPackToShipInApprovalPage',
          optionLabel: 'requisitionConstants.showPackToShipInApprovalPage',
        },
      ],
    },
  ],
  [
    'df524868-9d0a-18e6-80f5-76304ded7ab9',
    'pricePerPack',
    'Price per pack',
    'T',
    'Price per pack. Will be blank if price is not defined.',
    ['REFERENCE_DATA'],
    {
      columnType: 'CURRENCY',
    },
  ],
  [
    '5708ebf9-9317-4420-85aa-71b2ae92643d',
    'numberOfNewPatientsAdded',
    'Number of new patients added',
    'F',
    'New patients data.',
    ['USER_INPUT'],
    {
      options: [
        {
          id: '4957ebb4-297c-459e-a291-812e72286eff',
          optionName: 'dispensingUnitsForNewPatients',
          optionLabel: 'requisitionConstants.dispensingUnitsForNewPatients',
        },
        {
          id: '34b8e763-71a0-41f1-86b4-1829963f0704',
          optionName: 'newPatientCount',
          optionLabel: 'requisitionConstants.newPatientCount',
        },
      ],
    },
  ],
  [
    'e3a0c1fc-c2d5-11e6-af2d-3417eb83144e',
    'totalCost',
    'Total cost',
    'Q',
    'Total cost of the product based on quantity requested. Will be blank if price is not defined.',
    ['CALCULATED'],
    {
      columnType: 'CURRENCY',
    },
  ],
  [
    '720dd95b-b765-4afb-b7f2-7b22261c32f3',
    'adjustedConsumption',
    'Adjusted consumption',
    'N',
    'Total consumed quantity after adjusting for stockout days. Quantified in dispensing units.',
    ['CALCULATED'],
    {},
  ],
  [
    '89113ec3-40e9-4d81-9516-b56adba7f8cd',
    'averageConsumption',
    'Average consumption',
    'P',
    'Average consumption over a specified number of periods/months. Quantified in dispensing units.',
    ['STOCK_CARDS', 'CALCULATED'],
    {},
  ],
  [
    '913e1a4f-f3b0-40c6-a422-2f73608c6f3d',
    'maximumStockQuantity',
    'Maximum stock quantity',
    'H',
    'Maximum stock calculated based on consumption and max stock amounts. Quantified in dispensing units.',
    ['CALCULATED'],
    {
      options: [
        {
          id: 'ff2b350c-37f2-4801-b21e-27ca12c12b3c',
          optionName: 'default',
          optionLabel: 'requisitionConstants.default',
        },
      ],
    },
  ],
  [
    '5528576b-b1e7-48d9-bf32-fd0eefefaa9a',
    'calculatedOrderQuantity',
    'Calculated order quantity',
    'I',
    'Actual quantity needed after deducting stock in hand. This is quantified in dispensing units.',
    ['CALCULATED'],
    {},
  ],
  [
    'aa0a1a7e-e5cb-4385-b781-943316fa116a',
    'idealStockAmount',
    'Ideal Stock Amount',
    'G',
    'The Ideal Stock Amount is the target quantity for a specific commodity type, facility, and period.',
    ['REFERENCE_DATA'],
    {
      canBeChangedByUser: true,
    },
  ],
  [
    '9ac91518-38c7-494c-95d9-c37ef2ffff81',
    'calculatedOrderQuantityIsa',
    'Calc Order Qty ISA',
    'S',
    'Calculated Order Quantity ISA is based on an ISA configured by commodity type, and several trade items may fill for one commodity type.',
    ['CALCULATED'],
    {
      canBeChangedByUser: true,
    },
  ],
  [
    '5ba8b72d-277a-4da8-b10a-23f0cda23cb4',
    'totalReceivedQuantity',
    'Total received quantity',
    'B',
    'Total quantity received in the reporting period. This is quantified in dispensing units.',
    ['STOCK_CARDS', 'USER_INPUT'],
    {
      supportsTag: true,
    },
  ],
  [
    '9e825396-269d-4873-baa4-89054e2722f4',
    'totalConsumedQuantity',
    'Total consumed quantity',
    'C',
    'Quantity dispensed/consumed in the reporting period. This is quantified in dispensing units.',
    ['STOCK_CARDS', 'USER_INPUT', 'CALCULATED'],
    {
      supportsTag: true,
    },
  ],
  [
    'cd57f329-f549-4717-882e-ecbf98122c38',
    'totalLossesAndAdjustments',
    'Total losses and adjustments',
    'D',
    'All kind of losses/adjustments made at the facility.',
    ['STOCK_CARDS', 'USER_INPUT'],
    {
      supportsTag: true,
    },
  ],
  [
    '90a84767-1009-4d8e-be13-f006fce2a002',
    'additionalQuantityRequired',
    'Additional quantity required',
    'Z',
    'Additional quantity required for new patients',
    ['USER_INPUT'],
    {
      canBeChangedByUser: true,
    },
  ],
  [
    'c6dffdee-3813-40d9-8737-f531d5adf420',
    'skipped',
    'Skip',
    'S',
    'Select the check box below to skip a single product. Remove all data from the row prior to selection.',
    ['PREVIOUS_REQUISITION', 'USER_INPUT'],
    {
      canChangeOrder: false,
      columnType: 'BOOLEAN',
      options: [
        {
          id: '17d6e860-a746-4500-a0fa-afc84d799dca',
          optionName: 'disableSkippedLineItems',
          optionLabel: 'requisitionConstants.disableSkippedLineItems',
        },
        {
          id: '488e6882-563d-4b69-b7eb-fd59e7772a41',
          optionName: 'hideSkippedLineItems',
          optionLabel: 'requisitionConstants.hideSkippedLineItems',
        },
      ],
    },
  ],
  [
    'bde01507-3837-47b7-ae08-cec92c0c3cd2',
    'orderable.productCode',
    'Product code',
    'O',
    'Unique identifier for each commodity/product.',
    ['REFERENCE_DATA'],
    {
      canChangeOrder: false,
      columnType: 'TEXT',
    },
  ],
  [
    'e53e80de-fc63-4ecb-b6b2-ef376b34c926',
    'orderable.fullProductName',
    'Product',
    'R',
    'Primary name of the product.',
    ['REFERENCE_DATA'],
    {
      canChangeOrder: false,
      columnType: 'TEXT',
      isDisplayRequired: true,
    },
  ],
  [
    '61e6d059-10ef-40c4-a6e3-fa7b9ad741ec',
    'orderable.dispensable.displayUnit',
    'Unit/unit of issue',
    'U',
    'Dispensing unit for this product.',
    ['REFERENCE_DATA'],
    {
      columnType: 'TEXT',
    },
  ],
  [
    'ef7c65c6-1be3-410b-9a2e-8b9f68221e82',
    'numberOfPatientsOnTreatmentNextMonth',
    'No of Patients on Treatment next month (C)',
    'TC',
    'The number of patients who will be treated in the next month.',
    ['USER_INPUT', 'CALCULATED'],
    {
      canBeChangedByUser: true,
    },
  ],
  [
    '7563a92f-2c07-4b09-a88e-d0faa0baee93',
    'totalRequirement',
    'Total Requirement (E) E = C * D',
    'TE',
    'Product requirement for all patients.',
    ['CALCULATED'],
    {
      canBeChangedByUser: true,
    },
  ],
  [
    'd58e83a3-78ee-4657-b3d9-7b1adc983837',
    'totalQuantityNeededByHf',
    'Total Quantity Needed by HF (F) F = E * 2',
    'TF',
    'Total quantity of product needed by Health Facility.',
    ['CALCULATED'],
    {
      canBeChangedByUser: true,
    },
  ],
  [
    '421cd415-f127-4683-a396-a10a7bfdc384',
    'quantityToIssue',
    'Quantity to issue (G) G = F - A',
    'TG',
    'Number of products to be issued.',
    ['CALCULATED'],
    {
      canBeChangedByUser: true,
    },
  ],
  [
    'd173872d-f5e7-48a2-b0a7-c7fcae4208d4',
    'convertedQuantityToIssue',
    'Quantity to issue (converted to unit of measure) G/U',
    'TH',
    'Quantity to issue expressed in the units in which it is measured.',
    ['CALCULATED'],
    {
      canBeChangedByUser: true,
    },
  ],
  [
    '3efdf855-cc03-4ccc-97f2-60108bc4b7a3',
    'dosesPerPatient',
    'Individual Monthly Requirement (D)',
    'TD',
    'The amount of product for single patient.',
    ['REFERENCE_DATA'],
    {
      canBeChangedByUser: true,
    },
  ],
  [
    '1a079695-9f34-4339-850c-1fc0d9675314',
    'supplyingFacilityStockOnHand',
    'Supplying facility stock on hand',
    'SF',
    'Stock on hand at the supplying facility for this product, displayed during approval',
    ['SUPPLYING_FACILITY_STOCK'],
    {},
  ],
];

export const liveCatalog: ColumnDefinition[] = catalogRows.map(
  ([id, name, label, indicator, definition, sources, overrides]) => ({
    canChangeOrder: true,
    columnType: 'NUMERIC',
    mandatory: false,
    isDisplayRequired: false,
    canBeChangedByUser: false,
    supportsTag: false,
    options: [],
    id,
    name,
    label,
    indicator,
    definition,
    sources,
    ...overrides,
  }),
);

const columnOverrides: Record<string, Partial<TemplateColumn>> = {
  numberOfNewPatientsAdded: {
    isDisplayed: false,
    option: {
      id: '34b8e763-71a0-41f1-86b4-1829963f0704',
      optionName: 'newPatientCount',
      optionLabel: 'requisitionConstants.newPatientCount',
    },
  },
  adjustedConsumption: {},
  quantityToIssue: {
    isDisplayed: false,
  },
  totalLossesAndAdjustments: {
    source: 'USER_INPUT',
  },
  totalStockoutDays: {
    source: 'USER_INPUT',
  },
  packsToShip: {
    isDisplayed: false,
    option: {
      id: 'dcf41f06-3000-4af6-acf5-5de4fffc966f',
      optionName: 'showPackToShipInAllPages',
      optionLabel: 'requisitionConstants.showPackToShipInAllPages',
    },
  },
  skipped: {
    source: 'USER_INPUT',
    option: {
      id: '17d6e860-a746-4500-a0fa-afc84d799dca',
      optionName: 'disableSkippedLineItems',
      optionLabel: 'requisitionConstants.disableSkippedLineItems',
    },
  },
  'orderable.productCode': {},
  total: {
    isDisplayed: false,
  },
  totalConsumedQuantity: {
    source: 'USER_INPUT',
  },
  stockOnHand: {
    source: 'CALCULATED',
  },
  requestedQuantity: {},
  totalQuantityNeededByHf: {
    isDisplayed: false,
  },
  beginningBalance: {
    source: 'USER_INPUT',
  },
  dosesPerPatient: {
    isDisplayed: false,
  },
  convertedQuantityToIssue: {
    isDisplayed: false,
  },
  'orderable.dispensable.displayUnit': {
    label: 'Display Unit',
    definition: 'Display unit for this product.',
  },
  totalReceivedQuantity: {
    source: 'USER_INPUT',
  },
  approvedQuantity: {},
  'orderable.fullProductName': {},
  supplyingFacilityStockOnHand: {
    isDisplayed: false,
  },
  pricePerPack: {},
  numberOfPatientsOnTreatmentNextMonth: {
    isDisplayed: false,
    source: 'CALCULATED',
  },
  averageConsumption: {
    source: 'CALCULATED',
  },
  requestedQuantityExplanation: {},
  calculatedOrderQuantity: {},
  totalRequirement: {
    isDisplayed: false,
  },
  remarks: {},
  totalCost: {
    isDisplayed: false,
  },
  maximumStockQuantity: {
    isDisplayed: false,
    option: {
      id: 'ff2b350c-37f2-4801-b21e-27ca12c12b3c',
      optionName: 'default',
      optionLabel: 'requisitionConstants.default',
    },
  },
  additionalQuantityRequired: {
    isDisplayed: false,
  },
  idealStockAmount: {},
  calculatedOrderQuantityIsa: {},
};

const columns: Record<string, Omit<TemplateColumn, 'displayOrder'>> = Object.fromEntries(
  liveCatalog.map((column) => {
    const {
      id,
      name,
      label,
      indicator,
      definition,
      canChangeOrder,
      isDisplayRequired,
      supportsTag,
      sources,
      options,
    } = column;
    const columnDefinition: TemplateColumnDefinition = {
      id,
      name,
      canChangeOrder,
      isDisplayRequired,
      supportsTag,
      sources,
      options,
    };
    return [
      name,
      {
        name,
        label,
        indicator,
        definition,
        isDisplayed: true,
        source: sources[0],
        option: null,
        tag: null,
        columnDefinition,
        ...columnOverrides[name],
      },
    ];
  }),
);

type Fixture = Omit<RequisitionTemplate, 'columnsMap'> & {
  rows: [string, number, Partial<TemplateColumn>?][];
};
const fixtures: Fixture[] = [
  {
    id: '5a268780-fafd-4243-9551-5c7daa824913',
    numberOfPeriodsToAverage: 3,
    name: 'Family Planning',
    populateStockOnHandFromStockCards: false,
    program: {
      id: 'dce17f2e-af3e-40ad-8e00-3496adef44c3',
    },
    facilityTypes: [
      {
        id: '5fc213c6-1bd7-46f0-9883-57c05250ca90',
      },
      {
        id: '663b1d34-cc17-4d60-9619-e553e45aa441',
      },
      {
        id: 'ac1d268b-ce10-455f-bf87-9c667da8f060',
      },
      {
        id: 'caecea08-6b2f-4ba9-98b2-b87702ba57ba',
      },
    ],
    rejectionReasonWindowVisible: false,
    requisitionReportOnly: false,
    patientsTabEnabled: false,
    enableAvgConsumptionForCurrentPeriod: false,
    rows: [
      ['numberOfNewPatientsAdded', 20],
      ['adjustedConsumption', 22],
      ['quantityToIssue', 11],
      ['totalLossesAndAdjustments', 7],
      ['totalStockoutDays', 8],
      ['packsToShip', 13],
      ['skipped', 1],
      ['orderable.productCode', 2],
      ['total', 19],
      ['totalConsumedQuantity', 6],
      ['stockOnHand', 9],
      ['requestedQuantity', 15],
      ['totalQuantityNeededByHf', 10],
      ['beginningBalance', 4],
      ['dosesPerPatient', 8],
      ['convertedQuantityToIssue', 12],
      ['orderable.dispensable.displayUnit', 14],
      ['totalReceivedQuantity', 5],
      ['approvedQuantity', 17],
      ['orderable.fullProductName', 3],
      ['supplyingFacilityStockOnHand', 25],
      ['pricePerPack', 12],
      ['numberOfPatientsOnTreatmentNextMonth', 7],
      ['averageConsumption', 10],
      ['requestedQuantityExplanation', 16],
      ['calculatedOrderQuantity', 11],
      ['totalRequirement', 9],
      ['remarks', 18],
      ['totalCost', 21],
      ['maximumStockQuantity', 23],
      ['additionalQuantityRequired', 24],
    ],
  },
  {
    id: '4b30f6c9-b84b-4f17-8173-852101a5ea29',
    numberOfPeriodsToAverage: 3,
    name: 'Essential Meds',
    populateStockOnHandFromStockCards: false,
    program: {
      id: '10845cb9-d365-4aaa-badd-b4fa39c6a26a',
    },
    facilityTypes: [
      {
        id: '5fc213c6-1bd7-46f0-9883-57c05250ca90',
      },
      {
        id: '663b1d34-cc17-4d60-9619-e553e45aa441',
      },
      {
        id: 'ac1d268b-ce10-455f-bf87-9c667da8f060',
      },
      {
        id: 'caecea08-6b2f-4ba9-98b2-b87702ba57ba',
      },
    ],
    rejectionReasonWindowVisible: false,
    requisitionReportOnly: false,
    patientsTabEnabled: false,
    enableAvgConsumptionForCurrentPeriod: false,
    rows: [
      ['numberOfNewPatientsAdded', 21],
      [
        'adjustedConsumption',
        11,
        {
          label: 'Adj consumption',
        },
      ],
      ['quantityToIssue', 11],
      [
        'totalLossesAndAdjustments',
        6,
        {
          label: 'Loss/adj',
          definition: 'All losses/adjustments made at the facility.',
        },
      ],
      [
        'totalStockoutDays',
        8,
        {
          label: 'SOD',
        },
      ],
      [
        'packsToShip',
        18,
        {
          label: 'Packs CMST',
          isDisplayed: true,
        },
      ],
      ['skipped', 1],
      [
        'orderable.productCode',
        2,
        {
          label: 'Code',
        },
      ],
      ['total', 20],
      [
        'totalConsumedQuantity',
        7,
        {
          label: 'Qty used',
        },
      ],
      [
        'stockOnHand',
        5,
        {
          label: 'Close bal',
          source: 'USER_INPUT',
          definition: 'Stock on hand. This is quantified in dispensing units.',
        },
      ],
      [
        'requestedQuantity',
        13,
        {
          label: 'Qty req',
        },
      ],
      ['totalQuantityNeededByHf', 10],
      [
        'beginningBalance',
        10,
        {
          label: 'Open bal',
        },
      ],
      ['dosesPerPatient', 8],
      ['convertedQuantityToIssue', 12],
      [
        'orderable.dispensable.displayUnit',
        4,
        {
          label: 'UoI',
        },
      ],
      [
        'totalReceivedQuantity',
        9,
        {
          label: 'Qty rec',
        },
      ],
      [
        'approvedQuantity',
        15,
        {
          label: 'Qty approved',
        },
      ],
      [
        'orderable.fullProductName',
        3,
        {
          label: 'Product name',
        },
      ],
      ['supplyingFacilityStockOnHand', 25],
      [
        'pricePerPack',
        18,
        {
          isDisplayed: false,
        },
      ],
      ['numberOfPatientsOnTreatmentNextMonth', 7],
      [
        'averageConsumption',
        17,
        {
          isDisplayed: false,
        },
      ],
      [
        'requestedQuantityExplanation',
        14,
        {
          label: 'Qty req exp',
        },
      ],
      [
        'calculatedOrderQuantity',
        12,
        {
          label: 'Order qty',
          definition:
            'Order quantity to top up to 3 months of stock (average consumption for past 3 months - stock on hand)',
        },
      ],
      ['totalRequirement', 9],
      ['remarks', 16],
      ['totalCost', 22],
      ['maximumStockQuantity', 23],
      ['additionalQuantityRequired', 24],
    ],
  },
  {
    id: '6c4b004b-b7c9-46f0-bb1b-bd128d36729f',
    numberOfPeriodsToAverage: 3,
    name: 'EPI',
    populateStockOnHandFromStockCards: true,
    program: {
      id: '418bdc1d-c303-4bd0-b2d3-d8901150a983',
    },
    facilityTypes: [
      {
        id: '5fc213c6-1bd7-46f0-9883-57c05250ca90',
      },
      {
        id: 'caecea08-6b2f-4ba9-98b2-b87702ba57ba',
      },
    ],
    rejectionReasonWindowVisible: false,
    requisitionReportOnly: false,
    patientsTabEnabled: false,
    enableAvgConsumptionForCurrentPeriod: false,
    rows: [
      [
        'numberOfNewPatientsAdded',
        20,
        {
          isDisplayed: true,
        },
      ],
      ['adjustedConsumption', 22],
      ['quantityToIssue', 11],
      [
        'totalLossesAndAdjustments',
        7,
        {
          source: 'STOCK_CARDS',
          tag: 'adjustment',
        },
      ],
      [
        'totalStockoutDays',
        8,
        {
          source: 'STOCK_CARDS',
        },
      ],
      ['packsToShip', 14],
      ['skipped', 1],
      ['orderable.productCode', 2],
      ['idealStockAmount', 10],
      [
        'total',
        19,
        {
          isDisplayed: true,
        },
      ],
      [
        'totalConsumedQuantity',
        6,
        {
          source: 'STOCK_CARDS',
          tag: 'consumed',
        },
      ],
      [
        'stockOnHand',
        9,
        {
          source: 'STOCK_CARDS',
        },
      ],
      ['requestedQuantity', 15],
      ['totalQuantityNeededByHf', 10],
      [
        'beginningBalance',
        4,
        {
          source: 'STOCK_CARDS',
        },
      ],
      ['dosesPerPatient', 8],
      ['convertedQuantityToIssue', 12],
      ['orderable.dispensable.displayUnit', 24],
      [
        'totalReceivedQuantity',
        5,
        {
          source: 'STOCK_CARDS',
          tag: 'received',
        },
      ],
      ['approvedQuantity', 17],
      ['orderable.fullProductName', 3],
      ['supplyingFacilityStockOnHand', 26],
      ['pricePerPack', 23],
      ['calculatedOrderQuantityIsa', 11],
      ['numberOfPatientsOnTreatmentNextMonth', 7],
      [
        'averageConsumption',
        12,
        {
          source: 'STOCK_CARDS',
        },
      ],
      ['requestedQuantityExplanation', 16],
      ['calculatedOrderQuantity', 13],
      ['totalRequirement', 9],
      ['remarks', 18],
      [
        'totalCost',
        25,
        {
          isDisplayed: true,
        },
      ],
      [
        'maximumStockQuantity',
        21,
        {
          isDisplayed: true,
        },
      ],
      ['additionalQuantityRequired', 24],
    ],
  },
  {
    id: '37f29736-f0db-4de3-98ad-f8d85c848711',
    numberOfPeriodsToAverage: 3,
    name: 'Vaccine Stock-Based R&R Template',
    populateStockOnHandFromStockCards: true,
    program: {
      id: '418bdc1d-c303-4bd0-b2d3-d8901150a983',
    },
    facilityTypes: [
      {
        id: 'ac1d268b-ce10-455f-bf87-9c667da8f060',
      },
    ],
    rejectionReasonWindowVisible: false,
    requisitionReportOnly: false,
    patientsTabEnabled: false,
    enableAvgConsumptionForCurrentPeriod: false,
    rows: [
      [
        'numberOfNewPatientsAdded',
        20,
        {
          isDisplayed: true,
        },
      ],
      ['adjustedConsumption', 22],
      ['quantityToIssue', 11],
      [
        'totalLossesAndAdjustments',
        7,
        {
          source: 'STOCK_CARDS',
          tag: 'adjustment',
        },
      ],
      [
        'totalStockoutDays',
        8,
        {
          source: 'STOCK_CARDS',
        },
      ],
      ['packsToShip', 14],
      ['skipped', 1],
      ['orderable.productCode', 2],
      ['idealStockAmount', 10],
      [
        'total',
        19,
        {
          isDisplayed: true,
        },
      ],
      [
        'totalConsumedQuantity',
        6,
        {
          source: 'STOCK_CARDS',
          tag: 'consumed',
        },
      ],
      [
        'stockOnHand',
        9,
        {
          source: 'STOCK_CARDS',
        },
      ],
      ['requestedQuantity', 15],
      ['totalQuantityNeededByHf', 10],
      [
        'beginningBalance',
        4,
        {
          source: 'STOCK_CARDS',
        },
      ],
      ['dosesPerPatient', 8],
      ['convertedQuantityToIssue', 12],
      ['orderable.dispensable.displayUnit', 24],
      [
        'totalReceivedQuantity',
        5,
        {
          source: 'STOCK_CARDS',
          tag: 'received',
        },
      ],
      ['approvedQuantity', 17],
      ['orderable.fullProductName', 3],
      ['supplyingFacilityStockOnHand', 26],
      ['pricePerPack', 23],
      ['calculatedOrderQuantityIsa', 11],
      ['numberOfPatientsOnTreatmentNextMonth', 7],
      [
        'averageConsumption',
        12,
        {
          source: 'STOCK_CARDS',
        },
      ],
      ['requestedQuantityExplanation', 16],
      ['calculatedOrderQuantity', 13],
      ['totalRequirement', 9],
      ['remarks', 18],
      [
        'totalCost',
        25,
        {
          isDisplayed: true,
        },
      ],
      [
        'maximumStockQuantity',
        21,
        {
          isDisplayed: true,
        },
      ],
      ['additionalQuantityRequired', 24],
    ],
  },
  {
    id: '6fa1a58c-960b-4835-be22-05be5f7357e2',
    numberOfPeriodsToAverage: 3,
    name: 'CHAZ',
    populateStockOnHandFromStockCards: false,
    program: {
      id: 'ef9a2b39-e7ce-4ebe-930c-f5c6d15b578a',
    },
    facilityTypes: [
      {
        id: 'ac1d268b-ce10-455f-bf87-9c667da8f060',
      },
    ],
    rejectionReasonWindowVisible: false,
    requisitionReportOnly: false,
    patientsTabEnabled: false,
    enableAvgConsumptionForCurrentPeriod: false,
    rows: [
      ['numberOfNewPatientsAdded', 20],
      ['adjustedConsumption', 22],
      ['quantityToIssue', 11],
      ['totalLossesAndAdjustments', 7],
      ['totalStockoutDays', 8],
      ['packsToShip', 13],
      ['skipped', 1],
      ['orderable.productCode', 2],
      ['total', 19],
      ['totalConsumedQuantity', 6],
      ['stockOnHand', 9],
      ['requestedQuantity', 15],
      ['totalQuantityNeededByHf', 10],
      ['beginningBalance', 4],
      ['dosesPerPatient', 8],
      ['convertedQuantityToIssue', 12],
      ['orderable.dispensable.displayUnit', 14],
      ['totalReceivedQuantity', 5],
      ['approvedQuantity', 17],
      ['orderable.fullProductName', 3],
      ['supplyingFacilityStockOnHand', 25],
      ['pricePerPack', 12],
      ['numberOfPatientsOnTreatmentNextMonth', 7],
      ['averageConsumption', 10],
      ['requestedQuantityExplanation', 16],
      ['calculatedOrderQuantity', 11],
      ['totalRequirement', 9],
      ['remarks', 18],
      ['totalCost', 21],
      ['maximumStockQuantity', 23],
      ['additionalQuantityRequired', 24],
    ],
  },
  {
    id: '14e756d2-60a6-45fd-b135-3caff3f328cd',
    numberOfPeriodsToAverage: 3,
    name: 'Lab program',
    populateStockOnHandFromStockCards: false,
    program: {
      id: '8a0cf9c6-0591-4ce1-bbbb-ae55553db0dc',
    },
    facilityTypes: [
      {
        id: 'ac1d268b-ce10-455f-bf87-9c667da8f060',
      },
    ],
    rejectionReasonWindowVisible: false,
    requisitionReportOnly: false,
    patientsTabEnabled: false,
    enableAvgConsumptionForCurrentPeriod: false,
    rows: [
      ['numberOfNewPatientsAdded', 20],
      ['adjustedConsumption', 22],
      ['quantityToIssue', 11],
      ['totalLossesAndAdjustments', 7],
      ['totalStockoutDays', 8],
      ['packsToShip', 13],
      ['skipped', 1],
      ['orderable.productCode', 2],
      ['total', 19],
      ['totalConsumedQuantity', 6],
      ['stockOnHand', 9],
      ['requestedQuantity', 15],
      ['totalQuantityNeededByHf', 10],
      ['beginningBalance', 4],
      ['dosesPerPatient', 8],
      ['convertedQuantityToIssue', 12],
      ['orderable.dispensable.displayUnit', 14],
      ['totalReceivedQuantity', 5],
      ['approvedQuantity', 17],
      ['orderable.fullProductName', 3],
      ['supplyingFacilityStockOnHand', 25],
      ['pricePerPack', 12],
      ['numberOfPatientsOnTreatmentNextMonth', 7],
      ['averageConsumption', 10],
      ['requestedQuantityExplanation', 16],
      ['calculatedOrderQuantity', 11],
      ['totalRequirement', 9],
      ['remarks', 18],
      ['totalCost', 21],
      ['maximumStockQuantity', 23],
      ['additionalQuantityRequired', 24],
    ],
  },
  {
    id: '913f566e-a94d-467e-9309-f13db7685ff8',
    numberOfPeriodsToAverage: 3,
    name: 'TB Monthly',
    populateStockOnHandFromStockCards: false,
    program: {
      id: '5a666ff8-5d87-477e-8109-42f6ac666eb1',
    },
    facilityTypes: [
      {
        id: 'ac1d268b-ce10-455f-bf87-9c667da8f060',
      },
    ],
    rejectionReasonWindowVisible: false,
    requisitionReportOnly: false,
    patientsTabEnabled: true,
    enableAvgConsumptionForCurrentPeriod: false,
    rows: [
      ['numberOfNewPatientsAdded', 26],
      [
        'adjustedConsumption',
        28,
        {
          isDisplayed: false,
        },
      ],
      [
        'quantityToIssue',
        11,
        {
          isDisplayed: true,
        },
      ],
      [
        'totalLossesAndAdjustments',
        5,
        {
          label: 'Loss & Adjustments (B) ',
        },
      ],
      [
        'totalStockoutDays',
        17,
        {
          isDisplayed: false,
        },
      ],
      ['packsToShip', 21],
      ['skipped', 1],
      ['orderable.productCode', 2],
      ['total', 25],
      [
        'totalConsumedQuantity',
        16,
        {
          isDisplayed: false,
        },
      ],
      [
        'stockOnHand',
        4,
        {
          label: 'Stock on hand (A) ',
          source: 'USER_INPUT',
        },
      ],
      [
        'requestedQuantity',
        22,
        {
          isDisplayed: false,
        },
      ],
      [
        'totalQuantityNeededByHf',
        10,
        {
          isDisplayed: true,
        },
      ],
      [
        'beginningBalance',
        15,
        {
          isDisplayed: false,
        },
      ],
      [
        'dosesPerPatient',
        8,
        {
          isDisplayed: true,
        },
      ],
      [
        'convertedQuantityToIssue',
        12,
        {
          isDisplayed: true,
        },
      ],
      [
        'orderable.dispensable.displayUnit',
        6,
        {
          label: 'Unit of measure (U) ',
        },
      ],
      [
        'totalReceivedQuantity',
        13,
        {
          label: 'Quantity Issued ',
          definition: 'Quantity Issued.',
        },
      ],
      [
        'approvedQuantity',
        24,
        {
          isDisplayed: false,
        },
      ],
      ['orderable.fullProductName', 3],
      ['supplyingFacilityStockOnHand', 31],
      [
        'pricePerPack',
        20,
        {
          isDisplayed: false,
        },
      ],
      [
        'numberOfPatientsOnTreatmentNextMonth',
        7,
        {
          isDisplayed: true,
        },
      ],
      [
        'averageConsumption',
        18,
        {
          isDisplayed: false,
        },
      ],
      [
        'requestedQuantityExplanation',
        23,
        {
          isDisplayed: false,
        },
      ],
      [
        'calculatedOrderQuantity',
        19,
        {
          isDisplayed: false,
        },
      ],
      [
        'totalRequirement',
        9,
        {
          isDisplayed: true,
        },
      ],
      ['remarks', 14],
      ['totalCost', 27],
      ['maximumStockQuantity', 29],
      ['additionalQuantityRequired', 30],
    ],
  },
];

export const liveTemplates: RequisitionTemplate[] = fixtures.map(({ rows, ...template }) => ({
  ...template,
  columnsMap: Object.fromEntries(
    rows.map(([name, displayOrder, override]) => [
      name,
      { ...columns[name], displayOrder, ...override },
    ]),
  ),
}));
