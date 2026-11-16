import { useStore } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlertIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { withForm } from '@/components/form/form';
import type { ComboboxFieldItem, SelectFieldItem } from '@/components/form/form-fields';
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

type FieldProps = { field: ReportField; fields: readonly ReportField[]; userId: string };

const EMPTY: ReportFormValues = {};

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
                  placeholder={t('reports.generate.choose-date')}
                  clearLabel={parameter.required ? undefined : t('reports.generate.clear-date')}
                />
              );
            case 'boolean': {
              const items: SelectFieldItem[] = [
                ...(parameter.required
                  ? []
                  : [{ value: '', label: t('reports.generate.not-selected') }]),
                { value: 'true', label: t('reports.generate.true') },
                { value: 'false', label: t('reports.generate.false') },
              ];
              return (
                <control.SelectField
                  {...common}
                  items={items}
                  placeholder={t('reports.generate.select-option')}
                />
              );
            }
            case 'whole-number':
              return <control.NumberField {...common} />;
            default:
              return <control.TextField {...common} dir="auto" />;
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
    const failed = source.type === 'lookup' && query.isError;
    const unsupported = source.type === 'unsupported';
    const blocked = unsupported || waitingFor.length > 0 || loading || (failed && !query.data);

    return (
      <div className="flex flex-col gap-2">
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
              labelAction={loading ? <Spinner /> : undefined}
              disabled={blocked}
              items={items}
              placeholder={
                loading
                  ? t('reports.generate.loading-choices')
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
          <Alert variant="destructive" actionLayout="flow">
            <TriangleAlertIcon />
            <AlertTitle>
              {t('reports.generate.lookup-error-title', { name: field.label })}
            </AlertTitle>
            <AlertDescription>
              {query.error instanceof IncompleteLookupError
                ? t('reports.generate.lookup-incomplete')
                : t('reports.generate.lookup-error-description')}
            </AlertDescription>
            <AlertAction>
              <Button
                variant="outline"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                {query.isFetching && <Spinner data-icon="inline-start" />}
                {t('error.try-again')}
              </Button>
            </AlertAction>
          </Alert>
        )}
      </div>
    );
  },
});
