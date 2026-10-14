import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '@tanstack/react-form';
import { useSuspenseQuery } from '@tanstack/react-query';
import { GripVerticalIcon, LockKeyholeIcon } from 'lucide-react';
import { type CSSProperties, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LookupBoundary } from '@/components/dialog-parts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { templateReasonTagsOptions } from '@/features/requisition-templates/api/queries';
import type { TemplateEditorForm } from '@/features/requisition-templates/components/template-editor';
import { OPTION_KEYS, SOURCE_KEYS } from '@/features/requisition-templates/lib/column-labels';
import {
  STOCK_COLUMNS,
  setDisplayed,
  tagChoices,
} from '@/features/requisition-templates/lib/template-draft';
import {
  getRowError,
  type RowError,
} from '@/features/requisition-templates/lib/template-validation';
import type { TemplateColumn } from '@/features/requisition-templates/lib/types';

type Props = { form: TemplateEditorForm; column: TemplateColumn };

export const ColumnRow = memo(function ColumnRow({ form, column }: Props) {
  const { t } = useTranslation();
  const key = column.columnDefinition.id;
  const definition = column.columnDefinition;
  const draft = useStore(form.store, (state) => state.values.columns[key]);
  const stock = useStore(form.store, (state) => state.values.populateStockOnHandFromStockCards);
  const errorText = useStore(form.store, (state) =>
    JSON.stringify(getRowError(state.values, key) ?? null),
  );
  const error = JSON.parse(errorText) as RowError | null;
  const errorId = `template-row-${key}-error`;
  const describedBy = (field: RowError['field']) => (error?.field === field ? errorId : undefined);
  const sortable = useSortable({ id: key, disabled: { draggable: !definition.canChangeOrder } });
  const canChangeSource =
    definition.sources.length > 1 && !(stock && STOCK_COLUMNS.includes(definition.name));
  const option = definition.options.find((option) => option.id === draft.optionId);
  const optionName = (name: string) => (OPTION_KEYS[name] ? t(OPTION_KEYS[name]) : name);
  const named = (field: string) =>
    t('requisition-templates.configure.row-label', { label: draft.label, field });
  return (
    <TableRow
      ref={sortable.setNodeRef}
      drag
      data-dragging={sortable.isDragging}
      style={
        {
          '--row-transform': CSS.Transform.toString(sortable.transform),
          '--row-transition': sortable.transition,
        } as CSSProperties
      }
    >
      <TableCell>
        {definition.canChangeOrder ? (
          <div className="*:touch-none">
            <Button
              ref={sortable.setActivatorNodeRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              {...sortable.attributes}
              {...sortable.listeners}
              aria-label={t('requisition-templates.configure.move', { label: draft.label })}
            >
              <GripVerticalIcon />
            </Button>
          </div>
        ) : (
          <LockKeyholeIcon
            aria-label={t('requisition-templates.configure.fixed', { label: draft.label })}
            role="img"
            className="mx-auto size-4 text-muted-foreground"
          />
        )}
      </TableCell>
      <TableCell>
        <div className="flex justify-center">
          <form.AppField name={`columns.${key}.isDisplayed`}>
            {(field) => (
              <Checkbox
                checked={field.state.value}
                disabled={definition.isDisplayRequired}
                aria-label={t('requisition-templates.configure.display-label', {
                  label: draft.label,
                })}
                aria-invalid={error?.field === 'isDisplayed'}
                aria-describedby={describedBy('isDisplayed')}
                onBlur={field.handleBlur}
                onCheckedChange={(value) => {
                  const next = setDisplayed(form.state.values, key, value);
                  form.setFieldValue('columns', next.columns);
                }}
              />
            )}
          </form.AppField>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{column.indicator}</Badge>
      </TableCell>
      <TableCell>
        <form.AppField name={`columns.${key}.label`}>
          {(field) => (
            <field.TextField
              layout="inline"
              controlSize="sm"
              dir="auto"
              errorDescriptionId={describedBy('label')}
              label={named(t('requisition-templates.configure.label'))}
            />
          )}
        </form.AppField>
      </TableCell>
      <TableCell>
        <div className="group min-w-0 whitespace-normal">
          <form.AppField name={`columns.${key}.definition`}>
            {(field) => (
              <field.TextareaField
                layout="inline"
                errorDescriptionId={describedBy('definition')}
                dir="auto"
                describedBy={`template-row-${key}-counter`}
                maxLength={140}
                label={named(t('requisition-templates.configure.definition'))}
              />
            )}
          </form.AppField>
          <p
            id={`template-row-${key}-counter`}
            className="mt-1 hidden text-muted-foreground text-xs group-focus-within:block"
          >
            {t('requisition-templates.configure.characters-left', {
              count: 140 - (draft.definition?.length ?? 0),
            })}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="whitespace-normal">
          {canChangeSource ? (
            <form.AppField name={`columns.${key}.source`}>
              {(field) => (
                <field.SelectField
                  layout="inline"
                  size="sm"
                  errorDescriptionId={describedBy('source')}
                  label={named(t('requisition-templates.configure.source'))}
                  items={definition.sources.map((source) => ({
                    value: source,
                    label: t(SOURCE_KEYS[source]),
                  }))}
                />
              )}
            </form.AppField>
          ) : draft.source ? (
            t(SOURCE_KEYS[draft.source])
          ) : (
            ''
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2 whitespace-normal">
          {definition.name === 'averageConsumption' && (
            <div className="flex flex-col gap-1">
              <span aria-hidden="true" className="text-sm">
                {t('requisition-templates.configure.periods')}
              </span>
              <form.AppField name="numberOfPeriodsToAverage">
                {(field) => (
                  <field.NumberField
                    layout="inline"
                    controlSize="sm"
                    errorDescriptionId={describedBy('numberOfPeriodsToAverage')}
                    label={named(t('requisition-templates.configure.periods'))}
                  />
                )}
              </form.AppField>
            </div>
          )}
          {definition.options.length > 0 &&
            (canChangeSource || definition.name === 'packsToShip' ? (
              <form.AppField name={`columns.${key}.optionId`}>
                {(field) => (
                  <field.SelectField
                    layout="inline"
                    size="sm"
                    errorDescriptionId={describedBy('optionId')}
                    label={named(t('requisition-templates.configure.additional-options'))}
                    items={definition.options.map((option) => ({
                      value: option.id,
                      label: optionName(option.optionName),
                    }))}
                  />
                )}
              </form.AppField>
            ) : option ? (
              optionName(option.optionName)
            ) : (
              ''
            ))}
          {stock && definition.supportsTag && (
            <LookupBoundary
              label={named(t('requisition-templates.configure.tag'))}
              errorTitle={t('requisition-templates.form.lookup-error')}
              errorDescription={t('error.check-connection')}
            >
              <TagField
                label={draft.label}
                form={form}
                column={column}
                describedBy={describedBy('tag')}
              />
            </LookupBoundary>
          )}
          {error && (
            <p id={errorId} className="text-destructive/80 text-sm">
              {t(error.key, error.values)}
            </p>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

function TagField({
  form,
  column,
  describedBy,
  label,
}: Props & { describedBy: string | undefined; label: string }) {
  const { t } = useTranslation();
  const { data: tags } = useSuspenseQuery(templateReasonTagsOptions());
  const key = column.columnDefinition.id;
  const choicesText = useStore(form.store, (state) =>
    JSON.stringify(tagChoices(state.values, key, tags)),
  );
  const choices = JSON.parse(choicesText) as string[];
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden="true" className="text-sm">
        {t('requisition-templates.configure.tag')}
      </span>
      <form.AppField name={`columns.${key}.tag`}>
        {(field) => (
          <field.SelectField
            layout="inline"
            size="sm"
            errorDescriptionId={describedBy}
            label={t('requisition-templates.configure.row-label', {
              label,
              field: t('requisition-templates.configure.tag'),
            })}
            items={choices.map((tag) => ({ value: tag, label: tag }))}
          />
        )}
      </form.AppField>
    </div>
  );
}
