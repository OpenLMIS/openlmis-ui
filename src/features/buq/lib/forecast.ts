import type { BuqForecast, NamedItem } from '@/features/buq/lib/types';
import type { Orderable } from '@/features/reference-data/lib/types';
import { decimalText, toDecimal, toNumberText } from '@/lib/decimal';
import { toWholeNumber, wholeNumberText } from '@/lib/whole-number';

export type LineDraft = { verified: string; forecasted: string; remarkId: string };

export type FundingDraft = { sourceId: string; name: string; used: string; projected: string };

export type ForecastDraft = { lines: Record<string, LineDraft>; funding: FundingDraft[] };

export const WHOLE_NUMBER = wholeNumberText({
  required: 'buq.forecast.required',
  invalid: 'buq.forecast.whole-number',
  tooLarge: 'buq.forecast.too-large',
});

const AMOUNT_MESSAGES = {
  required: 'buq.forecast.required',
  invalid: 'buq.forecast.amount',
  tooLarge: 'buq.forecast.too-large',
  tooPrecise: 'buq.forecast.two-decimals',
} satisfies Parameters<typeof decimalText>[0];

export const FUNDING_AMOUNT = decimalText(AMOUNT_MESSAGES, { maxDecimals: 2 });

export const OPTIONAL_FUNDING_AMOUNT = decimalText(AMOUNT_MESSAGES, {
  optional: true,
  maxDecimals: 2,
});

export const numberError = (value: string) =>
  WHOLE_NUMBER.safeParse(value).error?.issues[0]?.message;

const cents = (value: number) => Math.round(value * 100) / 100;

export function initialDraft(
  forecast: BuqForecast,
  sources: readonly NamedItem[],
  mark = '.',
): ForecastDraft {
  const lines: Record<string, LineDraft> = {};
  for (const line of forecast.bottomUpQuantificationLineItems) {
    const verified = line.verifiedAnnualAdjustedConsumption ?? line.annualAdjustedConsumption ?? 0;
    lines[line.id] = {
      verified: String(verified),
      forecasted: String(line.forecastedDemand ?? verified),
      remarkId: line.remark?.id ?? '',
    };
  }
  const saved = forecast.fundingDetails?.sourcesOfFunds ?? [];
  const funding = saved.length
    ? saved.map((entry) => ({
        sourceId: entry.sourceOfFund.id,
        name: entry.sourceOfFund.name ?? '',
        used: toNumberText(entry.amountUsedInLastFinancialYear, mark),
        projected: toNumberText(entry.projectedFund, mark),
      }))
    : sources.map(({ id, name }) => ({ sourceId: id, name, used: '', projected: '' }));
  return { lines, funding };
}

export const withVerified = (verified: string): LineDraft => ({
  verified,
  forecasted: verified,
  remarkId: '',
});

export function withForecasted(line: LineDraft, forecasted: string): LineDraft {
  const next = { ...line, forecasted };
  const matching =
    numbersValid(next) && toWholeNumber(next.verified) === toWholeNumber(next.forecasted);
  return matching ? { ...next, remarkId: '' } : next;
}

export const needsRemark = (line: LineDraft) =>
  numbersValid(line) && toWholeNumber(line.verified) !== toWholeNumber(line.forecasted);

export const numbersValid = (line: LineDraft) =>
  WHOLE_NUMBER.safeParse(line.verified).success && WHOLE_NUMBER.safeParse(line.forecasted).success;

export const lineValid = (line: LineDraft) =>
  numbersValid(line) && (!needsRemark(line) || line.remarkId !== '');

export const fundingComplete = (funding: readonly FundingDraft[]) =>
  funding.length > 0 &&
  funding.every(
    ({ used, projected }) =>
      FUNDING_AMOUNT.safeParse(used).success && FUNDING_AMOUNT.safeParse(projected).success,
  );

export const lineCost = (line: LineDraft | undefined, price: number) =>
  line && WHOLE_NUMBER.safeParse(line.forecasted).success
    ? cents(toWholeNumber(line.forecasted) * price)
    : 0;

export function forecastTotals(draft: ForecastDraft, prices: Record<string, number>) {
  const totalCost = cents(
    Object.entries(draft.lines).reduce(
      (sum, [id, line]) => sum + lineCost(line, prices[id] ?? 0),
      0,
    ),
  );
  const totalProjectedFund = projectedTotal(draft.funding);
  return { totalCost, totalProjectedFund, gap: gapOf(totalProjectedFund, totalCost) };
}

const amountOf = (text: string) => {
  const amount = toDecimal(text) ?? 0;
  return Number.isFinite(amount) ? amount : 0;
};

export const projectedTotal = (funding: readonly FundingDraft[]) =>
  cents(funding.reduce((sum, { projected }) => sum + amountOf(projected), 0));

export const fundingEntered = (funding: readonly FundingDraft[]) =>
  funding.some(({ used, projected }) => used !== '' || projected !== '');

export const gapOf = (totalProjectedFund: number, totalCost: number) =>
  cents(totalProjectedFund - totalCost);

export function forecastBody(
  forecast: BuqForecast,
  draft: ForecastDraft,
  prices: Record<string, number>,
) {
  const totals = forecastTotals(draft, prices);
  const entered = fundingEntered(draft.funding);
  return {
    id: forecast.id,
    facilityId: forecast.facilityId,
    programId: forecast.programId,
    processingPeriodId: forecast.processingPeriodId,
    targetYear: forecast.targetYear,
    bottomUpQuantificationLineItems: forecast.bottomUpQuantificationLineItems.map((stored) => {
      const line = draft.lines[stored.id];
      return {
        id: stored.id,
        orderableId: stored.orderableId,
        annualAdjustedConsumption: stored.annualAdjustedConsumption,
        verifiedAnnualAdjustedConsumption: line ? toWholeNumber(line.verified) : null,
        forecastedDemand: line ? toWholeNumber(line.forecasted) : null,
        totalCost: lineCost(line, prices[stored.id] ?? 0),
        remark: line?.remarkId ? { id: line.remarkId } : null,
      };
    }),
    fundingDetails: {
      id: forecast.fundingDetails?.id,
      totalProjectedFund: entered ? totals.totalProjectedFund : null,
      totalForecastedCost: totals.totalCost,
      gap: entered ? totals.gap : null,
      sourcesOfFunds: entered
        ? draft.funding.map(({ sourceId, used, projected }) => ({
            sourceOfFund: { id: sourceId },
            amountUsedInLastFinancialYear: toDecimal(used),
            projectedFund: toDecimal(projected),
          }))
        : [],
    },
  };
}

export type GridModel = { lineId: string; category: string; name: string };

export type GridRow = { id: string; category: string } | { id: string; model: GridModel };

export const sortModels = (models: readonly GridModel[]) =>
  models.toSorted((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

export function pageRows(models: readonly GridModel[], pageIndex: number, pageSize: number) {
  const rows: GridRow[] = [];
  let previous: string | undefined;
  for (const model of models.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)) {
    if (model.category !== previous) {
      rows.push({ id: `category:${model.category}`, category: model.category });
      previous = model.category;
    }
    rows.push({ id: model.lineId, model });
  }
  return rows;
}

export type ProductInfo = {
  consumption: number;
  code: string;
  name: string;
  unit: string;
  price: number;
  category: string;
};

export function productInfo(
  orderable: Orderable | undefined,
  programId: string,
  consumption: number,
): ProductInfo {
  const programs = orderable?.programs ?? [];
  const entry = programs.find((program) => program.programId === programId) ?? programs[0];
  return {
    consumption,
    code: orderable?.productCode ?? '',
    name: orderable?.fullProductName ?? '',
    unit: orderable?.dispensable?.displayUnit ?? '',
    price: entry?.pricePerPack ?? 0,
    category: entry?.orderableCategoryDisplayName ?? '',
  };
}
