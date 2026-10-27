import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '@tanstack/react-form';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ChevronDownIcon, GripVerticalIcon, LockKeyholeIcon } from 'lucide-react';
import { type CSSProperties, memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CardBand,
  CardControlRow,
  CardDragPreview,
  CardListItem,
  CardRows,
} from '@/components/card-list';
import { LookupBoundary } from '@/components/dialog-parts';
import { SettingsItem } from '@/components/form/settings-list';
import { Block } from '@/components/skeleton-block';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { templateReasonTagsOptions } from '@/features/requisition-templates/api/queries';
import { TemplateColumnsColgroup } from '@/features/requisition-templates/components/template-columns-header';
import type { TemplateEditorForm } from '@/features/requisition-templates/components/template-editor';
import { OPTION_KEYS, SOURCE_KEYS } from '@/features/requisition-templates/lib/column-labels';
import {
  STOCK_COLUMNS,
  setDisplayed,
  type TemplateDraft,
  tagChoices,
} from '@/features/requisition-templates/lib/template-draft';
import {
  getRowErrors,
  type RowError,
} from '@/features/requisition-templates/lib/template-validation';
import { orEmpty } from '@/lib/empty-value';
import type { TemplateColumn } from '@/lib/requisition-template';
import { cn } from '@/lib/utils';

type Props = { form: TemplateEditorForm; column: TemplateColumn };
type Sortable = ReturnType<typeof useSortable>;

const rowErrorsCache = new WeakMap<TemplateDraft, Record<string, RowError>>();
function rowErrorsOf(values: TemplateDraft) {
  let errors = rowErrorsCache.get(values);
  if (!errors) {
    errors = getRowErrors(values);
    rowErrorsCache.set(values, errors);
  }
  return errors;
}

export const ColumnRow = memo(function ColumnRow({ form, column }: Props) {
  const { t } = useTranslation();
  const key = column.columnDefinition.id;
  const definition = column.columnDefinition;
  const label = useStore(form.store, (state) => state.values.columns[key].label) || column.label;
  const sortable = useSortable({
    id: key,
    disabled: { draggable: !definition.canChangeOrder },
    transition: { duration: 150, easing: 'ease-out' },
  });
  return (
    <TableRow
      ref={sortable.setNodeRef}
      drag
      data-dragging={sortable.isDragging}
      style={
        {
          '--row-transform': CSS.Translate.toString(sortable.transform),
          '--row-transition': sortable.isDragging ? 'none' : sortable.transition,
        } as CSSProperties
      }
    >
      <TableCell>
        {definition.canChangeOrder ? (
          <DragHandle
            attributes={sortable.attributes}
            label={t('requisition-templates.configure.move', { label })}
            listeners={sortable.listeners}
            setRef={sortable.setActivatorNodeRef}
          />
        ) : (
          <LockKeyholeIcon
            aria-label={t('requisition-templates.configure.fixed', { label })}
            role="img"
            className="mx-auto size-4 text-muted-foreground"
          />
        )}
      </TableCell>
      <ColumnCells form={form} column={column} />
    </TableRow>
  );
});

const DragHandle = memo(function DragHandle({
  attributes,
  label,
  listeners,
  setRef,
}: {
  attributes: Sortable['attributes'];
  label: string;
  listeners: Sortable['listeners'];
  setRef: (element: HTMLElement | null) => void;
}) {
  return (
    <div className="flex justify-center *:cursor-grab *:touch-none *:active:cursor-grabbing">
      <Button
        ref={setRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        {...attributes}
        {...listeners}
        aria-label={label}
      >
        <GripVerticalIcon />
      </Button>
    </div>
  );
});

function useColumnFields({ form, column }: Props, cards: boolean) {
  const { t } = useTranslation();
  const key = column.columnDefinition.id;
  const definition = column.columnDefinition;
  const label = useStore(form.store, (state) => state.values.columns[key].label);
  const definitionText = useStore(form.store, (state) => state.values.columns[key].definition);
  const source = useStore(form.store, (state) => state.values.columns[key].source);
  const optionId = useStore(form.store, (state) => state.values.columns[key].optionId);
  const stock = useStore(form.store, (state) => state.values.populateStockOnHandFromStockCards);
  const errorText = useStore(form.store, (state) =>
    JSON.stringify(rowErrorsOf(state.values)[key] ?? null),
  );
  const error = JSON.parse(errorText) as RowError | null;
  const errorId = `template-row-${key}-error`;
  const describedBy = (field: RowError['field']) => (error?.field === field ? errorId : undefined);
  const canChangeSource =
    definition.sources.length > 1 && !(stock && STOCK_COLUMNS.includes(definition.name));
  const option = definition.options.find((option) => option.id === optionId);
  const optionName = (name: string) => (OPTION_KEYS[name] ? t(OPTION_KEYS[name]) : name);
  const named = (field: string) => t('requisition-templates.configure.row-label', { label, field });
  const size = cards ? 'default' : 'sm';
  const tagField = (
    <TagField
      label={label}
      form={form}
      column={column}
      describedBy={describedBy('tag')}
      size={size}
    />
  );
  return {
    label,
    error: error && (
      <p id={errorId} className="text-destructive/80 text-sm">
        {t(error.key, error.values)}
      </p>
    ),
    display: (
      <form.AppField name={`columns.${key}.isDisplayed`}>
        {(field) => (
          <Checkbox
            id={`template-row-${key}-display`}
            checked={field.state.value}
            disabled={definition.isDisplayRequired}
            aria-label={t('requisition-templates.configure.display-label', { label })}
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
    ),
    labelField: (
      <form.AppField name={`columns.${key}.label`}>
        {(field) => (
          <field.TextField
            layout="inline"
            controlSize={size}
            dir="auto"
            errorDescriptionId={describedBy('label')}
            label={named(t('requisition-templates.configure.label'))}
          />
        )}
      </form.AppField>
    ),
    definitionField: (
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
            count: 140 - (definitionText?.length ?? 0),
          })}
        </p>
      </div>
    ),
    sourceField: canChangeSource && (
      <form.AppField name={`columns.${key}.source`}>
        {(field) => (
          <field.SelectField
            layout="inline"
            size={size}
            wrap={cards ? 'wrap' : undefined}
            errorDescriptionId={describedBy('source')}
            label={named(t('requisition-templates.configure.source'))}
            items={definition.sources.map((source) => ({
              value: source,
              label: t(SOURCE_KEYS[source]),
            }))}
          />
        )}
      </form.AppField>
    ),
    sourceText: source ? t(SOURCE_KEYS[source]) : '',
    periodsField: definition.name === 'averageConsumption' && (
      <form.AppField name="numberOfPeriodsToAverage">
        {(field) => (
          <field.NumberField
            layout="inline"
            controlSize={size}
            errorDescriptionId={describedBy('numberOfPeriodsToAverage')}
            label={named(t('requisition-templates.configure.periods'))}
          />
        )}
      </form.AppField>
    ),
    optionField: definition.options.length > 0 &&
      (canChangeSource || definition.name === 'packsToShip') && (
        <form.AppField name={`columns.${key}.optionId`}>
          {(field) => (
            <field.SelectField
              layout="inline"
              size={size}
              wrap={cards ? 'wrap' : undefined}
              errorDescriptionId={describedBy('optionId')}
              label={named(t('requisition-templates.configure.additional-options'))}
              items={definition.options.map((option) => ({
                value: option.id,
                label: optionName(option.optionName),
              }))}
            />
          )}
        </form.AppField>
      ),
    optionText: definition.options.length > 0 && option ? optionName(option.optionName) : '',
    tagField: stock && definition.supportsTag && (
      <LookupBoundary
        label={named(t('requisition-templates.configure.tag'))}
        pendingFallback={cards ? <Block className="h-8 w-full" /> : undefined}
        errorTitle={t('requisition-templates.form.lookup-error')}
        errorDescription={t('error.check-connection')}
      >
        {cards ? (
          tagField
        ) : (
          <div className="flex flex-col gap-1">
            <span aria-hidden="true" className="text-sm">
              {t('requisition-templates.configure.tag')}
            </span>
            {tagField}
          </div>
        )}
      </LookupBoundary>
    ),
  };
}

const ColumnCells = memo(function ColumnCells({ form, column }: Props) {
  const { t } = useTranslation();
  const fields = useColumnFields({ form, column }, false);
  return (
    <>
      <TableCell>
        <div className="flex justify-center">{fields.display}</div>
      </TableCell>
      <TableCell>
        <div className="flex justify-center">
          <Indicator>{column.indicator}</Indicator>
        </div>
      </TableCell>
      <TableCell>{fields.labelField}</TableCell>
      <TableCell>{fields.definitionField}</TableCell>
      <TableCell>
        <div className="whitespace-normal">{fields.sourceField || fields.sourceText}</div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2 whitespace-normal">
          {fields.periodsField && (
            <div className="flex flex-col gap-1">
              <span aria-hidden="true" className="text-sm">
                {t('requisition-templates.configure.periods')}
              </span>
              {fields.periodsField}
            </div>
          )}
          {fields.optionField || fields.optionText}
          {fields.tagField}
          {fields.error}
        </div>
      </TableCell>
    </>
  );
});

export const ColumnCard = memo(function ColumnCard({ form, column }: Props) {
  const definition = column.columnDefinition;
  const sortable = useSortable({
    id: definition.id,
    disabled: { draggable: !definition.canChangeOrder },
    transition: { duration: 150, easing: 'ease-out' },
  });
  return (
    <CardListItem
      drag={{
        y: sortable.transform?.y ?? 0,
        animate: !sortable.isDragging && Boolean(sortable.transition),
        dragging: sortable.isDragging,
      }}
      itemRef={sortable.setNodeRef}
    >
      <ColumnCardBody
        attributes={sortable.attributes}
        column={column}
        form={form}
        listeners={sortable.listeners}
        setRef={sortable.setActivatorNodeRef}
      />
    </CardListItem>
  );
});

const ColumnCardBody = memo(function ColumnCardBody({
  form,
  column,
  attributes,
  listeners,
  setRef,
}: Props & {
  attributes: Sortable['attributes'];
  listeners: Sortable['listeners'];
  setRef: (element: HTMLElement | null) => void;
}) {
  const { t } = useTranslation();
  const fields = useColumnFields({ form, column }, true);
  const name = fields.label || column.label;
  return (
    <>
      <CardBand>
        <div className="flex min-w-0 items-center gap-2">
          {column.columnDefinition.canChangeOrder ? (
            <DragHandle
              attributes={attributes}
              label={t('requisition-templates.configure.move', { label: name })}
              listeners={listeners}
              setRef={setRef}
            />
          ) : (
            <FixedIcon label={t('requisition-templates.configure.fixed', { label: name })} />
          )}
          <Indicator>{column.indicator}</Indicator>
          <bdi className="min-w-0 wrap-anywhere">{name}</bdi>
        </div>
        <label
          className="flex shrink-0 items-center gap-2 font-normal"
          htmlFor={`template-row-${column.columnDefinition.id}-display`}
        >
          <span aria-hidden>{t('requisition-templates.configure.display')}</span>
          {fields.display}
        </label>
      </CardBand>
      {fields.error && <div className="px-4 py-1.5">{fields.error}</div>}
      <CardRows>
        <CardControlRow label={t('requisition-templates.configure.label')}>
          {fields.labelField}
        </CardControlRow>
        <CardControlRow label={t('requisition-templates.configure.definition')} width="wide">
          {fields.definitionField}
        </CardControlRow>
        {fields.sourceField ? (
          <CardControlRow label={t('requisition-templates.configure.source')}>
            {fields.sourceField}
          </CardControlRow>
        ) : (
          <SettingsItem label={t('requisition-templates.configure.source')}>
            {orEmpty(fields.sourceText)}
          </SettingsItem>
        )}
        {fields.periodsField && (
          <CardControlRow label={t('requisition-templates.configure.periods')}>
            {fields.periodsField}
          </CardControlRow>
        )}
        {fields.optionField ? (
          <CardControlRow label={t('requisition-templates.configure.additional-options')}>
            {fields.optionField}
          </CardControlRow>
        ) : (
          fields.optionText && (
            <SettingsItem label={t('requisition-templates.configure.additional-options')}>
              {fields.optionText}
            </SettingsItem>
          )
        )}
        {fields.tagField && (
          <CardControlRow label={t('requisition-templates.configure.tag')}>
            {fields.tagField}
          </CardControlRow>
        )}
      </CardRows>
    </>
  );
});

function Indicator({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive font-semibold text-destructive-foreground text-xs ring-1 ring-destructive ring-offset-1 ring-offset-background">
      {children}
    </span>
  );
}

function FixedIcon({ label }: { label: string }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center">
      <LockKeyholeIcon aria-label={label} role="img" className="size-4 text-muted-foreground" />
    </span>
  );
}

function TagField({
  form,
  column,
  describedBy,
  label,
  size,
}: Props & { describedBy: string | undefined; label: string; size: 'default' | 'sm' }) {
  const { t } = useTranslation();
  const { data: tags } = useSuspenseQuery(templateReasonTagsOptions());
  const key = column.columnDefinition.id;
  const choicesText = useStore(form.store, (state) =>
    JSON.stringify(tagChoices(state.values, key, tags)),
  );
  const choices = JSON.parse(choicesText) as string[];
  return (
    <form.AppField name={`columns.${key}.tag`}>
      {(field) => (
        <field.SelectField
          layout="inline"
          size={size}
          errorDescriptionId={describedBy}
          label={t('requisition-templates.configure.row-label', {
            label,
            field: t('requisition-templates.configure.tag'),
          })}
          items={choices.map((tag) => ({ value: tag, label: tag }))}
        />
      )}
    </form.AppField>
  );
}

function PreviewSelect({ label, size = 'sm' }: { label: string; size?: 'default' | 'sm' }) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-1.5 rounded-md border border-input bg-background pe-2 ps-2.5 text-sm',
        size === 'sm' ? 'h-7' : 'h-8',
      )}
    >
      <span className="truncate">{label}</span>
      <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

function usePreview({ form, column }: Props) {
  const { t } = useTranslation();
  const key = column.columnDefinition.id;
  const definition = column.columnDefinition;
  const {
    columns,
    populateStockOnHandFromStockCards: stock,
    numberOfPeriodsToAverage,
  } = form.state.values;
  const draft = columns[key];
  const canChangeSource =
    definition.sources.length > 1 && !(stock && STOCK_COLUMNS.includes(definition.name));
  const option = definition.options.find((option) => option.id === draft.optionId);
  return {
    t,
    definition,
    draft,
    stock,
    numberOfPeriodsToAverage,
    canChangeSource,
    option,
    editableOption: canChangeSource || definition.name === 'packsToShip',
    source: draft.source ? t(SOURCE_KEYS[draft.source]) : '',
    optionName: option
      ? OPTION_KEYS[option.optionName]
        ? t(OPTION_KEYS[option.optionName])
        : option.optionName
      : '',
  };
}

export function ColumnCardPreview({ form, column }: Props) {
  const {
    t,
    definition,
    draft,
    stock,
    numberOfPeriodsToAverage,
    canChangeSource,
    option,
    editableOption,
    source,
    optionName,
  } = usePreview({ form, column });
  return (
    <CardDragPreview>
      <CardBand>
        <div className="flex min-w-0 items-center gap-2">
          {definition.canChangeOrder ? (
            <div className="flex justify-center">
              <Button type="button" size="icon-sm" tabIndex={-1}>
                <GripVerticalIcon />
              </Button>
            </div>
          ) : (
            <FixedIcon label={t('requisition-templates.configure.fixed', { label: draft.label })} />
          )}
          <Indicator>{column.indicator}</Indicator>
          <bdi className="min-w-0 wrap-anywhere">{draft.label || column.label}</bdi>
        </div>
        <span className="flex shrink-0 items-center gap-2 font-normal">
          {t('requisition-templates.configure.display')}
          <Checkbox checked={draft.isDisplayed} tabIndex={-1} />
        </span>
      </CardBand>
      <CardRows>
        <CardControlRow label={t('requisition-templates.configure.label')}>
          <Input dir="auto" readOnly tabIndex={-1} value={draft.label} />
        </CardControlRow>
        <CardControlRow label={t('requisition-templates.configure.definition')} width="wide">
          <Textarea
            dir="auto"
            readOnly
            size="inline"
            tabIndex={-1}
            value={draft.definition ?? ''}
          />
        </CardControlRow>
        {canChangeSource ? (
          <CardControlRow label={t('requisition-templates.configure.source')}>
            <PreviewSelect label={source} size="default" />
          </CardControlRow>
        ) : (
          <SettingsItem label={t('requisition-templates.configure.source')}>
            {orEmpty(source)}
          </SettingsItem>
        )}
        {definition.name === 'averageConsumption' && (
          <CardControlRow label={t('requisition-templates.configure.periods')}>
            <Input readOnly tabIndex={-1} value={numberOfPeriodsToAverage ?? ''} />
          </CardControlRow>
        )}
        {definition.options.length > 0 && editableOption ? (
          <CardControlRow label={t('requisition-templates.configure.additional-options')}>
            <PreviewSelect label={optionName} size="default" />
          </CardControlRow>
        ) : (
          option && (
            <SettingsItem label={t('requisition-templates.configure.additional-options')}>
              {optionName}
            </SettingsItem>
          )
        )}
        {stock && definition.supportsTag && (
          <CardControlRow label={t('requisition-templates.configure.tag')}>
            <PreviewSelect label={draft.tag ?? ''} size="default" />
          </CardControlRow>
        )}
      </CardRows>
    </CardDragPreview>
  );
}

export function ColumnRowPreview({ form, column }: Props) {
  const {
    definition,
    draft,
    numberOfPeriodsToAverage,
    canChangeSource,
    option,
    source,
    optionName,
  } = usePreview({ form, column });
  return (
    <Table layout="fixed">
      <TemplateColumnsColgroup />
      <TableBody>
        <TableRow drag="overlay" aria-hidden="true">
          <TableCell>
            <div className="flex justify-center">
              <Button type="button" size="icon-sm" tabIndex={-1}>
                <GripVerticalIcon />
              </Button>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex justify-center">
              <Checkbox checked={draft.isDisplayed} tabIndex={-1} />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex justify-center">
              <span className="flex size-6 items-center justify-center rounded-full bg-destructive font-semibold text-destructive-foreground text-xs ring-1 ring-destructive ring-offset-1 ring-offset-background">
                {column.indicator}
              </span>
            </div>
          </TableCell>
          <TableCell>
            <Field surface="background">
              <Input controlSize="sm" dir="auto" readOnly tabIndex={-1} value={draft.label} />
            </Field>
          </TableCell>
          <TableCell>
            <div className="whitespace-normal">
              <Field surface="background">
                <Textarea
                  dir="auto"
                  readOnly
                  size="inline"
                  tabIndex={-1}
                  value={draft.definition ?? ''}
                />
              </Field>
            </div>
          </TableCell>
          <TableCell>
            {canChangeSource ? (
              <Field surface="background">
                <PreviewSelect label={source} />
              </Field>
            ) : (
              source
            )}
          </TableCell>
          <TableCell>
            <Field surface="background">
              {definition.name === 'averageConsumption' && (
                <Input
                  controlSize="sm"
                  readOnly
                  tabIndex={-1}
                  value={numberOfPeriodsToAverage ?? ''}
                />
              )}
              {option &&
                (canChangeSource || definition.name === 'packsToShip' ? (
                  <PreviewSelect label={optionName} />
                ) : (
                  optionName
                ))}
            </Field>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
