import * as z from 'zod';
import { isoDate } from '@/features/new-project/lib/types';

export const MOVEMENT_TYPES = ['Transfer', 'Adjustment', 'Receipt', 'Shipment'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const HANDLING_TAGS = ['Fragile', 'Refrigerated', 'Hazmat', 'Priority'] as const;
export type HandlingTag = (typeof HANDLING_TAGS)[number];

/*
  Base plain-object shapes - composable without losing refinements. The
  step-level schemas (typeStepSchema, etc.) are what `goNext()` validates
  on forward navigation. The combined schema (stockMovementSchema) is
  what the form validates on final submit.

  We compose by spreading raw shapes into `z.object({ ...a, ...b })`
  rather than `.merge()`ing, because `.merge()` on a `ZodEffects` (what
  `.superRefine()` returns) silently drops the effect. Cross-field
  refinements therefore live on `.superRefine()` at the combined level
  and are also re-applied at the step level where relevant.
*/

const typeShape = {
  type: z.enum(MOVEMENT_TYPES),
  referenceCode: z
    .string()
    .trim()
    .min(3, 'At least 3 characters.')
    .max(32, 'At most 32 characters.'),
  occurredAt: isoDate,
  handlingTags: z.array(z.enum(HANDLING_TAGS)),
};

const locationsShape = {
  sourceWarehouseId: z.string().min(1, 'Pick a source.'),
  destinationWarehouseId: z.string().min(1, 'Pick a destination.'),
  notes: z.string().max(500, 'At most 500 characters.'),
  signatureRequired: z.boolean(),
};

const itemRowSchema = z.object({
  skuId: z.string().min(1, 'Pick a SKU.'),
  quantity: z.number().int('Must be a whole number.').positive('Must be greater than 0.'),
});

const itemsShape = {
  items: z
    .array(itemRowSchema)
    .min(1, 'Add at least one item.')
    .refine(
      (rows) =>
        new Set(rows.map((r) => r.skuId).filter(Boolean)).size ===
        rows.filter((r) => r.skuId).length,
      { message: 'Each SKU can only appear once.' },
    ),
};

const reviewShape = {
  acceptTerms: z.boolean().refine((v) => v, 'Confirm the details to continue.'),
};

export const typeStepSchema = z.object(typeShape);

export const locationsStepSchema = z.object(locationsShape).superRefine((v, ctx) => {
  if (
    v.sourceWarehouseId &&
    v.destinationWarehouseId &&
    v.sourceWarehouseId === v.destinationWarehouseId
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['destinationWarehouseId'],
      message: 'Source and destination must differ.',
    });
  }
});

export const itemsStepSchema = z.object(itemsShape);
export const reviewStepSchema = z.object(reviewShape);

export const stockMovementSchema = z
  .object({ ...typeShape, ...locationsShape, ...itemsShape, ...reviewShape })
  .superRefine((v, ctx) => {
    if (v.sourceWarehouseId === v.destinationWarehouseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinationWarehouseId'],
        message: 'Source and destination must differ.',
      });
    }
  });

export const stepSchemas = [
  typeStepSchema,
  locationsStepSchema,
  itemsStepSchema,
  reviewStepSchema,
] as const;

export type StockMovementInput = z.infer<typeof stockMovementSchema>;
export type StockMovementItem = z.infer<typeof itemRowSchema>;

export const DEFAULT_STOCK_MOVEMENT: StockMovementInput = {
  type: 'Transfer',
  referenceCode: '',
  occurredAt: '',
  handlingTags: [],
  sourceWarehouseId: '',
  destinationWarehouseId: '',
  notes: '',
  signatureRequired: false,
  items: [],
  acceptTerms: false,
};

export type Warehouse = {
  id: string;
  name: string;
  code: string;
  region: string;
};

export const MOCK_WAREHOUSES: Warehouse[] = [
  { id: 'wh-krk', name: 'Kraków Main', code: 'KRK-01', region: 'EU-Central' },
  { id: 'wh-waw', name: 'Warsaw Hub', code: 'WAW-01', region: 'EU-Central' },
  { id: 'wh-ber', name: 'Berlin Distribution', code: 'BER-01', region: 'EU-Central' },
  { id: 'wh-ams', name: 'Amsterdam Port', code: 'AMS-01', region: 'EU-West' },
  { id: 'wh-lon', name: 'London Fulfillment', code: 'LON-01', region: 'EU-West' },
  { id: 'wh-nyc', name: 'New York East', code: 'NYC-01', region: 'NA-East' },
  { id: 'wh-sfo', name: 'San Francisco West', code: 'SFO-01', region: 'NA-West' },
  { id: 'wh-sgp', name: 'Singapore APAC', code: 'SGP-01', region: 'APAC' },
];

export type Sku = {
  id: string;
  name: string;
  sku: string;
  unit: string;
};

export const MOCK_SKUS: Sku[] = [
  { id: 'sku-001', name: 'Widget A', sku: 'WDG-001', unit: 'pcs' },
  { id: 'sku-002', name: 'Widget B', sku: 'WDG-002', unit: 'pcs' },
  { id: 'sku-003', name: 'Gadget Pro', sku: 'GAD-003', unit: 'pcs' },
  { id: 'sku-004', name: 'Component X', sku: 'CMP-004', unit: 'pcs' },
  { id: 'sku-005', name: 'Component Y', sku: 'CMP-005', unit: 'pcs' },
  { id: 'sku-006', name: 'Assembly Kit', sku: 'ASM-006', unit: 'kit' },
  { id: 'sku-007', name: 'Cable Bundle', sku: 'CBL-007', unit: 'm' },
  { id: 'sku-008', name: 'Power Unit', sku: 'PWR-008', unit: 'pcs' },
  { id: 'sku-009', name: 'Fastener Pack', sku: 'FST-009', unit: 'box' },
  { id: 'sku-010', name: 'Sensor Module', sku: 'SEN-010', unit: 'pcs' },
];
