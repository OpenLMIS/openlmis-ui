import { adjustmentTotal } from '@/features/requisitions/lib/adjustments';
import type { RequisitionLine } from '@/features/requisitions/lib/lines';
import {
  calculatePatientQuantities,
  PATIENT_QUANTITY_COLUMNS,
  type PatientQuantities,
  type PatientsData,
  parsePatients,
  patientsForProduct,
} from '@/features/requisitions/lib/patients';
import type { Requisition, RequisitionLineItem } from '@/features/requisitions/lib/requisition';

const preAuthorization = new Set(['INITIATED', 'REJECTED', 'SUBMITTED']);
const patientOverrideStatuses = new Set([
  'AUTHORIZED',
  'IN_APPROVAL',
  'APPROVED',
  'RELEASED',
  'RELEASED_WITHOUT_ORDER',
]);
const ratioScale = 10n ** 1000n;

const patientsByRecord = new WeakMap<
  Requisition,
  { json: Requisition['patientsData']; data: PatientsData }
>();

function recordPatients(requisition: Requisition): PatientsData {
  const cached = patientsByRecord.get(requisition);
  if (cached && cached.json === requisition.patientsData) return cached.data;
  const data = parsePatients(requisition.patientsData);
  patientsByRecord.set(requisition, { json: requisition.patientsData, data });
  return data;
}

export function packsToShip(
  quantity: number,
  netContent: number | null | undefined,
  threshold = 0,
  roundToZero = false,
): number {
  if (quantity <= 0 || !netContent || netContent < 0) return 0;
  const remainder = quantity % netContent;
  const packs =
    Math.floor(quantity / netContent) + (remainder > 0 && remainder > threshold ? 1 : 0);
  return packs === 0 && !roundToZero ? 1 : packs;
}

function orderQuantity(
  line: RequisitionLineItem,
  requisition: Pick<Requisition, 'status' | 'template'>,
): number {
  if (!preAuthorization.has(requisition.status)) return line.approvedQuantity ?? 0;
  return (
    line.requestedQuantity ??
    (requisition.template.populateStockOnHandFromStockCards
      ? line.calculatedOrderQuantityIsa
      : line.calculatedOrderQuantity) ??
    0
  );
}

function adjustedConsumption(
  consumed: number,
  days: number,
  stockout: number,
  additional: number,
): number {
  if (consumed === 0) return 0;
  const availableDays = days - stockout;
  if (availableDays === 0) return consumed;
  const numerator = BigInt(days) * ratioScale;
  const denominator = BigInt(availableDays);
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const ratio =
    quotient +
    (2n * (remainder < 0n ? -remainder : remainder) >=
    (denominator < 0n ? -denominator : denominator)
      ? denominator < 0n
        ? -1n
        : 1n
      : 0n);
  const scaled = BigInt(consumed) * ratio;
  const result = scaled / ratioScale + (scaled % ratioScale > 0n ? 1n : 0n);
  return Number(result) + Math.max(additional, 0);
}

function maximumStock(average: number, periods: number): number {
  const [coefficient = '0', exponent = '0'] = String(periods).toLowerCase().split('e');
  const [whole = '0', fraction = ''] = coefficient.split('.');
  const scale = fraction.length - Number(exponent);
  const multiplier = BigInt(whole + fraction) * BigInt(average);
  if (scale <= 0) return Number(multiplier * 10n ** BigInt(-scale));
  const divisor = 10n ** BigInt(scale);
  const absolute = multiplier < 0n ? -multiplier : multiplier;
  const rounded = absolute / divisor + (2n * (absolute % divisor) >= divisor ? 1n : 0n);
  return Number(multiplier < 0n ? -rounded : rounded);
}

export function calculateLine(
  model: RequisitionLine,
  requisition: Requisition,
  monthsInPeriod: number,
  patientData?: PatientsData,
): RequisitionLineItem {
  const line = { ...model.line };
  if (line.skipped) return line;
  const { template } = requisition;
  const calculated = (name: string) => template.columnsMap[name]?.source === 'CALCULATED';
  const displayed = (name: string) => template.columnsMap[name]?.isDisplayed;
  if (model.fullSupply && !requisition.emergency) {
    if (!template.populateStockOnHandFromStockCards) {
      line.totalLossesAndAdjustments = adjustmentTotal(
        line.stockAdjustments ?? [],
        requisition.stockAdjustmentReasons ?? [],
      );
    }
    const stock = () =>
      (line.beginningBalance ?? 0) +
      (line.totalReceivedQuantity ?? 0) +
      (line.totalLossesAndAdjustments ?? 0);
    if (!displayed('stockOnHand')) line.stockOnHand = null;
    else if (calculated('stockOnHand'))
      line.stockOnHand = stock() - (line.totalConsumedQuantity ?? 0);
    if (!displayed('totalConsumedQuantity')) line.totalConsumedQuantity = null;
    else if (calculated('totalConsumedQuantity'))
      line.totalConsumedQuantity = stock() - (line.stockOnHand ?? 0);
    if (displayed('total') && calculated('total'))
      line.total = (line.beginningBalance ?? 0) + (line.totalReceivedQuantity ?? 0);
    if (calculated('adjustedConsumption')) {
      line.adjustedConsumption = adjustedConsumption(
        line.totalConsumedQuantity ?? 0,
        30 * monthsInPeriod,
        line.totalStockoutDays ?? 0,
        template.columnsMap.additionalQuantityRequired?.isDisplayed
          ? (line.additionalQuantityRequired ?? 0)
          : 0,
      );
    }
    if (calculated('averageConsumption')) {
      const previous = line.previousAdjustedConsumptions ?? [];
      line.averageConsumption = template.enableAvgConsumptionForCurrentPeriod
        ? Math.ceil((line.adjustedConsumption ?? 0) / 2)
        : Math.ceil(
            (previous.reduce((sum, value) => sum + value, 0) + (line.adjustedConsumption ?? 0)) /
              (previous.length + 1),
          );
    }
    const maxStock = () =>
      maximumStock(line.averageConsumption ?? 0, model.approvedProduct?.maxPeriodsOfStock ?? 0);
    if (displayed('maximumStockQuantity') && calculated('maximumStockQuantity'))
      line.maximumStockQuantity = maxStock();
    if (displayed('calculatedOrderQuantity') && calculated('calculatedOrderQuantity'))
      line.calculatedOrderQuantity = Math.max(
        (line.maximumStockQuantity ?? maxStock()) -
          (line.stockOnHand ?? stock() - (line.totalConsumedQuantity ?? 0)),
        0,
      );
    if (displayed('calculatedOrderQuantityIsa') && calculated('calculatedOrderQuantityIsa'))
      line.calculatedOrderQuantityIsa =
        line.idealStockAmount == null
          ? null
          : Math.max(line.idealStockAmount - (line.stockOnHand ?? 0), 0);
  }
  line.pricePerPack = model.program?.pricePerPack ?? 0;
  line.dosesPerPatient = model.program?.dosesPerPatient ?? null;
  if (calculated('numberOfPatientsOnTreatmentNextMonth')) {
    const data = patientData ?? recordPatients(requisition);
    line.numberOfPatientsOnTreatmentNextMonth =
      patientOverrideStatuses.has(requisition.status) &&
      line.numberOfPatientsOnTreatmentNextMonth != null
        ? line.numberOfPatientsOnTreatmentNextMonth
        : data.unreadable
          ? null
          : patientsForProduct(data, model.product?.productCode ?? '');
  }
  const stored: Partial<PatientQuantities> = {};
  for (const name of PATIENT_QUANTITY_COLUMNS) {
    if (!calculated(name)) stored[name] = line[name] ?? null;
  }
  const patientValues = calculatePatientQuantities(
    line.numberOfPatientsOnTreatmentNextMonth,
    line.dosesPerPatient,
    line.stockOnHand,
    model.product?.netContent,
    stored,
  );
  line.patientQuantitiesNotAvailable = patientValues.notAvailable;
  for (const name of PATIENT_QUANTITY_COLUMNS) {
    if (calculated(name)) line[name] = patientValues[name];
  }
  if (!template.columnsMap.packsToShip || calculated('packsToShip'))
    line.packsToShip = packsToShip(
      orderQuantity(line, requisition),
      model.product?.netContent,
      model.product?.packRoundingThreshold ?? 0,
      model.product?.roundToZero,
    );
  if (!template.columnsMap.totalCost || calculated('totalCost'))
    line.totalCost = (line.packsToShip ?? 0) * line.pricePerPack;
  return line;
}

export function calculateTotals(lines: readonly RequisitionLine[]) {
  let fullSupply = 0;
  let nonFullSupply = 0;
  for (const model of lines) {
    if (model.line.skipped) continue;
    if (model.fullSupply) fullSupply += model.line.totalCost ?? 0;
    else nonFullSupply += model.line.totalCost ?? 0;
  }
  return { fullSupply, nonFullSupply, total: fullSupply + nonFullSupply };
}
