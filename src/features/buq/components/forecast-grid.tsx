import { useStore } from '@tanstack/react-form';
import { type ColumnDef, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { CellText, TableCards } from '@/components/display/table-cards';
import { Field } from '@/components/ui/field';
import type { ForecastFormApi } from '@/features/buq/components/use-forecast-form';
import {
  type GridModel,
  type GridRow,
  lineCost,
  needsRemark,
  numberError,
  type ProductInfo,
  pageRows,
  withForecasted,
  withVerified,
} from '@/features/buq/lib/forecast';
import { formatMoney } from '@/features/buq/lib/money';
import { FORECAST_SORT, type ForecastSearch } from '@/features/buq/lib/search';
import type { NamedItem } from '@/features/buq/lib/types';
import type { CurrencySettings } from '@/features/reference-data/lib/types';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

type GridState = {
  form: ForecastFormApi;
  remarks: readonly NamedItem[];
  shown: (lineId: string) => boolean;
  disabled: boolean;
  cards: boolean;
};

type GridData = {
  products: Record<string, ProductInfo>;
  consumption: Record<string, number>;
  currency: CurrencySettings;
};

const GridContext = createContext<GridState | null>(null);

function useGrid() {
  const state = useContext(GridContext);
  if (!state) throw new Error('Forecast grid cells need the grid state.');
  return state;
}

const columnHelper = createColumnHelper<DataTableFeatures, GridRow>();

const lineOf = (row: GridRow) => ('model' in row ? row.model : undefined);

function useCellError(form: ForecastFormApi, name: `lines.${string}`, error: string | undefined) {
  useEffect(() => {
    form.setFieldMeta(name, (meta) => ({
      ...meta,
      isTouched: !!error,
      errorMap: { onChange: error },
    }));
  }, [form, name, error]);
}

function NumberCell({
  lineId,
  part,
  label,
}: {
  lineId: string;
  part: 'verified' | 'forecasted';
  label: string;
}) {
  const { form, shown, disabled, cards } = useGrid();
  const name: `lines.${string}.${'verified' | 'forecasted'}` = `lines.${lineId}.${part}`;
  const value = useStore(form.store, (state) => state.values.lines[lineId]?.[part] ?? '');
  useCellError(form, name, shown(lineId) ? numberError(value) : undefined);
  return (
    <Field surface="background">
      <form.AppField
        listeners={{
          onChange: ({ value: next }) => {
            const line = form.getFieldValue(`lines.${lineId}`);
            if (!line) return;
            form.setFieldValue(
              `lines.${lineId}`,
              part === 'verified' ? withVerified(next) : withForecasted(line, next),
            );
          },
        }}
        name={name}
      >
        {(field) => (
          <field.NumberField
            controlSize={cards ? 'default' : 'sm'}
            disabled={disabled}
            hideErrors={!cards}
            label={label}
            layout="inline"
          />
        )}
      </form.AppField>
    </Field>
  );
}

function RemarkCell({ lineId, label }: { lineId: string; label: string }) {
  const { t } = useTranslation();
  const { form, shown, disabled, remarks, cards } = useGrid();
  const line = useStore(form.store, (state) => state.values.lines[lineId]);
  const required = line ? needsRemark(line) : false;
  const missing = required && !line?.remarkId;
  useCellError(
    form,
    `lines.${lineId}.remarkId`,
    missing && shown(lineId) ? 'buq.forecast.remark-required' : undefined,
  );
  const items = useMemo(
    () => remarks.map(({ id, name }) => ({ value: id, label: name })),
    [remarks],
  );
  return (
    <Field surface="background">
      <form.AppField name={`lines.${lineId}.remarkId`}>
        {(field) => (
          <field.SelectField
            disabled={disabled || (!required && !line?.remarkId)}
            hideErrors={!cards}
            items={items}
            label={label}
            layout="inline"
            placeholder={t('buq.forecast.select-remark')}
            size={cards ? undefined : 'sm'}
          />
        )}
      </form.AppField>
    </Field>
  );
}

function LineCost({
  lineId,
  price,
  currency,
}: {
  lineId: string;
  price: number;
  currency: CurrencySettings;
}) {
  const { form } = useGrid();
  const line = useStore(form.store, (state) => state.values.lines[lineId]);
  return formatMoney(lineCost(line, price), currency);
}

function createColumns(t: TFunction, { products, consumption, currency }: GridData) {
  const product = (row: GridRow) => {
    const model = lineOf(row);
    return model ? products[model.lineId] : undefined;
  };
  const input = (row: GridRow, render: (lineId: string, name: string) => ReactNode) => {
    const model = lineOf(row);
    return model ? render(model.lineId, products[model.lineId]?.name ?? '') : null;
  };
  return columnHelper.columns([
    columnHelper.display({
      id: 'code',
      header: t('buq.forecast.code'),
      cell: ({ row }) => product(row.original)?.code ?? '',
      meta: { label: t('buq.forecast.code'), className: 'w-32' },
    }),
    columnHelper.display({
      id: 'product',
      header: t('buq.forecast.product'),
      cell: ({ row }) => (
        <CellText overflow="clamp">
          <bdi>{product(row.original)?.name ?? ''}</bdi>
        </CellText>
      ),
      meta: { label: t('buq.forecast.product') },
    }),
    columnHelper.display({
      id: 'unit',
      header: t('buq.forecast.unit'),
      cell: ({ row }) => product(row.original)?.unit ?? '',
      meta: { label: t('buq.forecast.unit'), className: 'w-28' },
    }),
    columnHelper.display({
      id: 'consumption',
      header: t('buq.forecast.consumption'),
      cell: ({ row }) => {
        const model = lineOf(row.original);
        return model ? String(consumption[model.lineId] ?? 0) : '';
      },
      meta: { label: t('buq.forecast.consumption'), className: 'w-28' },
    }),
    columnHelper.display({
      id: 'verified',
      header: t('buq.forecast.verified-column'),
      cell: ({ row }) =>
        input(row.original, (lineId, name) => (
          <NumberCell
            label={t('buq.forecast.verified', { product: name })}
            lineId={lineId}
            part="verified"
          />
        )),
      meta: { label: t('buq.forecast.verified-column'), className: 'w-32', skeleton: 'control' },
    }),
    columnHelper.display({
      id: 'forecasted',
      header: t('buq.forecast.forecasted-column'),
      cell: ({ row }) =>
        input(row.original, (lineId, name) => (
          <NumberCell
            label={t('buq.forecast.forecasted', { product: name })}
            lineId={lineId}
            part="forecasted"
          />
        )),
      meta: {
        label: t('buq.forecast.forecasted-column'),
        className: 'w-32',
        skeleton: 'control',
      },
    }),
    columnHelper.display({
      id: 'price',
      header: t('buq.forecast.price'),
      cell: ({ row }) => {
        const info = product(row.original);
        return info ? formatMoney(info.price, currency) : '';
      },
      meta: { label: t('buq.forecast.price'), className: 'w-28' },
    }),
    columnHelper.display({
      id: 'cost',
      header: t('buq.forecast.cost'),
      cell: ({ row }) =>
        input(row.original, (lineId) => (
          <LineCost currency={currency} lineId={lineId} price={products[lineId]?.price ?? 0} />
        )),
      meta: { label: t('buq.forecast.cost'), className: 'w-32' },
    }),
    columnHelper.display({
      id: 'remark',
      header: t('buq.forecast.remark-column'),
      cell: ({ row }) =>
        input(row.original, (lineId, name) => (
          <RemarkCell label={t('buq.forecast.remark', { product: name })} lineId={lineId} />
        )),
      meta: { label: t('buq.forecast.remark-column'), className: 'w-48', skeleton: 'control' },
    }),
  ]);
}

const getRowId = (row: GridRow) => row.id;
const headingOf = (row: GridRow) => ('category' in row ? row.category : undefined);

export function ForecastGrid({
  models,
  products,
  consumption,
  currency,
  isPageInvalid,
  search,
  onSearchChange,
  ...state
}: GridState &
  GridData & {
    models: readonly GridModel[];
    isPageInvalid: (pageIndex: number) => boolean;
    search: ForecastSearch;
    onSearchChange: SearchChange<ForecastSearch>;
  }) {
  const { t } = useTranslation();
  const { pageIndex, pageSize } = toPaginationState(search);
  const columns = useMemo<ColumnDef<DataTableFeatures, GridRow>[]>(
    () => createColumns(t, { products, consumption, currency }),
    [t, products, consumption, currency],
  );
  const data = useMemo(() => pageRows(models, pageIndex, pageSize), [models, pageIndex, pageSize]);
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: FORECAST_SORT,
    onSearchChange,
    cards: state.cards,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount: models.length,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
  });
  const footer = <DataTablePagination isPageInvalid={isPageInvalid} table={table} />;
  return (
    <GridContext value={state}>
      {state.cards ? (
        <TableCards
          footer={footer}
          heading={headingOf}
          listRef={pageStart.ref}
          table={table}
          title="product"
        />
      ) : (
        <DataTable footer={footer} heading={headingOf} layout="auto" table={table} />
      )}
    </GridContext>
  );
}
