import { useStore } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { TriangleAlertIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineFailure } from '@/components/app-shell/offline-notice';
import { withForm } from '@/components/form/form';
import type { ComboboxFieldItem } from '@/components/form/form-fields';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { reportParameterOptionsOptions } from '@/features/reports/api/queries';
import { IncompleteLookupError, projectOptions } from '@/features/reports/lib/report-lookups';
import type {
  ReportChoiceSource,
  ReportField,
  ReportFormValues,
} from '@/features/reports/lib/report-parameters';
import { isRefused } from '@/lib/http';
import { reportCaughtError } from '@/lib/report-error';

type FieldProps = { field: ReportField; fields: readonly ReportField[]; userId: string };

const EMPTY: ReportFormValues = {};

const LOOKUP_LOADING_KEYS: Partial<Record<string, ParseKeys>> = {
  '/orderables': 'reports.generate.loading-products',
  '/facilities': 'reports.generate.loading-facilities',
  '/facilityTypes': 'reports.generate.loading-facility-types',
  '/geographicZones/search': 'reports.generate.loading-zones',
  '/programs': 'reports.generate.loading-programs',
  '/processingPeriods': 'reports.generate.loading-periods',
};

/** One template parameter, drawn with the control legacy would choose for it. */
export const ReportParameterField = withForm({
  defaultValues: EMPTY,
  props: {} as FieldProps,
  render: function Render({ form, field: parameter, fields, userId }) {
    const { t } = useTranslation();
    const description =
      parameter.help === 'geographic-zone'
        ? t('reports.generate.help-geographic-zone')
        : parameter.help === 'due-days'
          ? t('reports.generate.help-due-days')
          : undefined;
    const children = fields.filter(
      (other) =>
        other.kind === 'choice' &&
        other.source.type === 'lookup' &&
        other.source.dependencies.some(({ parentKey }) => parentKey === parameter.key),
    );
    const listeners = children.length
      ? {
          onChange: () => {
            for (const child of children) form.setFieldValue(child.key, null);
          },
        }
      : undefined;
    const common = { label: parameter.label, required: parameter.required, description };

    if (parameter.kind === 'choice')
      return (
        <ReportChoiceField
          form={form}
          field={parameter}
          source={parameter.source}
          fields={fields}
          userId={userId}
          description={description}
          listeners={listeners}
        />
      );
    return (
      <form.AppField name={parameter.key} listeners={listeners}>
        {(control) => {
          switch (parameter.kind) {
            case 'date':
              return (
                <control.DateField
                  {...common}
                  size="lg"
                  placeholder={t('reports.generate.choose-date')}
                  clearLabel={parameter.required ? undefined : t('reports.generate.clear-date')}
                />
              );
            case 'boolean': {
              const items: ComboboxFieldItem[] = [
                { value: 'true', label: t('reports.generate.true') },
                { value: 'false', label: t('reports.generate.false') },
              ];
              return (
                <control.ComboboxField
                  {...common}
                  size="lg"
                  items={items}
                  placeholder={t('reports.generate.select-option')}
                  emptyMessage={t('reports.generate.no-matches')}
                  clearLabel={t('reports.generate.clear-choice', { name: parameter.label })}
                />
              );
            }
            case 'whole-number':
              return <control.NumberField {...common} controlSize="lg" />;
            default:
              return <control.TextField {...common} controlSize="lg" dir="auto" />;
          }
        }}
      </form.AppField>
    );
  },
});

type ChoiceProps = FieldProps & {
  source: ReportChoiceSource;
  description?: string;
  listeners?: { onChange: () => void };
};

const ReportChoiceField = withForm({
  defaultValues: EMPTY,
  props: {} as ChoiceProps,
  render: function Render({ form, field, source, fields, userId, description, listeners }) {
    const { t } = useTranslation();
    const dependencies = source.type === 'lookup' ? source.dependencies : [];
    const parentValues = useStore(form.store, (state) =>
      JSON.stringify(dependencies.map(({ parentKey }) => state.values[parentKey] ?? null)),
    );
    const parents = useMemo(() => JSON.parse(parentValues) as (string | null)[], [parentValues]);
    const params = useMemo(
      () =>
        parents.some((value) => !value)
          ? null
          : Object.fromEntries(
              dependencies.map(({ placeholder }, index) => [placeholder, parents[index] as string]),
            ),
      [dependencies, parents],
    );
    const lookup = source.type === 'lookup' ? source.lookup : null;
    const select = useCallback(
      (items: unknown[]) =>
        lookup ? projectOptions(items, lookup.valueProperty, lookup.labelProperty) : [],
      [lookup],
    );
    const query = useQuery({
      ...reportParameterOptionsOptions(userId, lookup ?? { method: 'GET', path: '' }, params ?? {}),
      enabled: Boolean(lookup && params),
      select,
    });
    const items: readonly ComboboxFieldItem[] =
      source.type === 'static' ? source.options : (query.data ?? []);
    const waitingFor = dependencies
      .filter((_, index) => !parents[index])
      .map(({ parentKey }) => fields.find((other) => other.key === parentKey)?.label ?? '');
    const loading = source.type === 'lookup' && Boolean(params) && query.isPending;
    const loadingKey =
      field.name === 'district'
        ? 'reports.generate.loading-districts'
        : LOOKUP_LOADING_KEYS[lookup?.path ?? ''];
    const failed = source.type === 'lookup' && query.isError;
    const unsupported = source.type === 'unsupported';
    const blocked = unsupported || waitingFor.length > 0 || loading || (failed && !query.data);

    return (
      <div className="flex flex-col gap-2" data-report-field={field.key}>
        <form.AppField name={field.key} listeners={listeners}>
          {(control) => (
            <control.ComboboxField
              label={field.label}
              required={field.required}
              description={
                waitingFor.length > 0
                  ? t('reports.generate.choose-parent-first', { name: waitingFor.join(', ') })
                  : description
              }
              loading={loading}
              disabled={blocked}
              items={items}
              placeholder={
                loading
                  ? loadingKey
                    ? t(loadingKey)
                    : t('reports.generate.loading-field', { name: field.label })
                  : !blocked && items.length === 0
                    ? t('reports.generate.no-choices')
                    : t('reports.generate.select-option')
              }
              emptyMessage={t('reports.generate.no-matches')}
              clearLabel={t('reports.generate.clear-choice', { name: field.label })}
              virtualized
              size="lg"
            />
          )}
        </form.AppField>
        {unsupported && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>{t('reports.generate.unsupported-title')}</AlertTitle>
            <AlertDescription>{t('reports.generate.unsupported-description')}</AlertDescription>
          </Alert>
        )}
        {failed && (
          <LookupError
            name={field.label}
            error={query.error}
            pending={query.isFetching}
            retry={() => void query.refetch()}
          />
        )}
      </div>
    );
  },
});

function LookupError({
  name,
  error,
  pending,
  retry,
}: {
  name: string;
  error: unknown;
  pending: boolean;
  retry: () => void;
}) {
  const { t } = useTranslation();
  const offline = useOfflineFailure(error, retry);
  useEffect(() => reportCaughtError(error, {}), [error]);
  return (
    <Alert variant="destructive" actionLayout="flow">
      <TriangleAlertIcon />
      <AlertTitle>{t('reports.generate.lookup-error-title', { name })}</AlertTitle>
      <AlertDescription>
        {offline
          ? t('offline.notice-description')
          : isRefused(error)
            ? t('reports.source-refused')
            : error instanceof IncompleteLookupError
              ? t('reports.generate.lookup-incomplete')
              : t('reports.generate.lookup-error-description')}
      </AlertDescription>
      <AlertAction>
        <Button
          type="button"
          data-lookup-retry
          variant="outline"
          disabled={pending}
          onClick={retry}
        >
          {pending && <Spinner data-icon="inline-start" />}
          {t('error.try-again')}
        </Button>
      </AlertAction>
    </Alert>
  );
}
