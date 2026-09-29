import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { useFieldContext } from '@/components/form/form-context';
import { useFormatError } from '@/components/form/form-messages';
import { SettingsRowFrame } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

/** `row` for a `SettingsList` row; `inline` keeps the label for screen readers only, e.g. in a table. */
type FieldLayout = 'stacked' | 'row' | 'inline';

type FieldProps = {
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  layout?: FieldLayout;
};

type FieldFrameProps = FieldProps & {
  /** Beside the label in a row, such as a status badge. */
  badge?: ReactNode;
  action?: ReactNode;
  state: ReturnType<typeof useFieldErrors>;
  /** The control, which takes the field's name as its id. */
  children: ReactNode;
};

/** The field's errors as display text, whether there are any, and what the control is described by. */
function useFieldErrors(description?: ReactNode, extraDescribedBy?: string, badge?: ReactNode) {
  const field = useFieldContext<unknown>();
  const formatError = useFormatError();
  const errors = field.state.meta.errors.map((error: unknown) => ({
    message:
      typeof error === 'string'
        ? formatError(error)
        : error && typeof error === 'object' && 'message' in error
          ? formatError(String(error.message))
          : undefined,
  }));
  const isInvalid = errors.length > 0;
  const descriptionId = `${field.name}-description`;
  const errorId = `${field.name}-error`;
  const badgeId = `${field.name}-badge`;
  // Read out with the control, so a screen reader hears the hint and, after a submit, the error.
  const describedBy =
    [
      badge ? badgeId : '',
      description ? descriptionId : '',
      extraDescribedBy ?? '',
      isInvalid ? errorId : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return { errors, isInvalid, descriptionId, errorId, badgeId, describedBy };
}

/** A label's text with the required mark, for any label, including a skeleton's. */
export function FieldLabelText({ label, required }: Pick<FieldProps, 'label' | 'required'>) {
  return (
    <span>
      {label}
      {required && (
        <span aria-hidden="true" className="ms-0.5 text-destructive">
          *
        </span>
      )}
    </span>
  );
}

/** For screen readers only; not a direct `Field` child, whose `sr-only` rule would size it to its text. */
function HiddenFromView({ children }: { children: ReactNode }) {
  return (
    <div className="contents">
      <div className="sr-only">{children}</div>
    </div>
  );
}

/** Label, control, description and error, laid out as the field's `layout` asks. */
function FieldFrame({
  layout = 'stacked',
  label,
  badge,
  action,
  description,
  required,
  disabled,
  state: { errors, isInvalid, descriptionId, errorId, badgeId },
  children,
}: FieldFrameProps) {
  const field = useFieldContext<unknown>();
  const labelText = <FieldLabelText label={label} required={required} />;
  const descriptionNode = description && (
    <FieldDescription id={descriptionId}>{description}</FieldDescription>
  );
  const details = (
    <>
      {layout === 'inline' ? <HiddenFromView>{descriptionNode}</HiddenFromView> : descriptionNode}
      {isInvalid && <FieldError errors={errors} id={errorId} />}
    </>
  );

  if (layout === 'row') {
    return (
      <Field data-disabled={disabled} data-invalid={isInvalid} spacing="tight">
        <SettingsRowFrame
          badge={badge && <span id={badgeId}>{badge}</span>}
          description={descriptionNode}
          label={
            <FieldLabel htmlFor={field.name} weight="normal">
              {labelText}
            </FieldLabel>
          }
          value="control"
        >
          <div className="flex items-center gap-2">
            {action}
            <div className="min-w-0 flex-1">{children}</div>
          </div>
          {isInvalid && <FieldError errors={errors} id={errorId} />}
        </SettingsRowFrame>
      </Field>
    );
  }
  return (
    <Field data-disabled={disabled} data-invalid={isInvalid} spacing="tight">
      {layout === 'inline' ? (
        <HiddenFromView>
          <label htmlFor={field.name}>{labelText}</label>
        </HiddenFromView>
      ) : (
        <FieldLabel htmlFor={field.name}>{labelText}</FieldLabel>
      )}
      {children}
      {details}
    </Field>
  );
}

type TextFieldProps = FieldProps &
  Pick<FieldFrameProps, 'badge'> & {
    type?: 'text' | 'email' | 'tel' | 'time';
    autoComplete?: string;
    placeholder?: string;
    /** `ltr` for values read left to right in any language, such as codes and phone numbers. */
    dir?: 'ltr';
  };

export function TextField({
  label,
  layout,
  badge,
  description,
  required,
  disabled,
  type = 'text',
  autoComplete,
  placeholder,
  dir,
}: TextFieldProps) {
  const field = useFieldContext<string>();
  const state = useFieldErrors(description, undefined, badge);
  const { isInvalid, describedBy: ariaDescribedBy } = state;

  return (
    <FieldFrame
      badge={badge}
      description={description}
      disabled={disabled}
      label={label}
      layout={layout}
      required={required}
      state={state}
    >
      <Input
        aria-describedby={ariaDescribedBy}
        aria-invalid={isInvalid}
        aria-required={required}
        autoComplete={autoComplete}
        dir={dir}
        disabled={disabled}
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={field.state.value}
      />
    </FieldFrame>
  );
}

type TextareaFieldProps = FieldProps & {
  placeholder?: string;
};

export function TextareaField({
  label,
  layout,
  description,
  required,
  disabled,
  placeholder,
}: TextareaFieldProps) {
  const field = useFieldContext<string>();
  const state = useFieldErrors(description);
  const { isInvalid, describedBy: ariaDescribedBy } = state;

  return (
    <FieldFrame
      description={description}
      disabled={disabled}
      label={label}
      layout={layout}
      required={required}
      state={state}
    >
      <Textarea
        aria-describedby={ariaDescribedBy}
        aria-invalid={isInvalid}
        aria-required={required}
        disabled={disabled}
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        placeholder={placeholder}
        value={field.state.value}
      />
    </FieldFrame>
  );
}

type PasswordFieldProps = FieldProps & {
  autoComplete?: 'new-password' | 'current-password';
  placeholder?: string;
  /** Names the button that reveals the password, for screen readers. */
  showLabel: string;
  hideLabel: string;
  describedBy?: string;
};

export function PasswordField({
  label,
  layout,
  description,
  required,
  disabled,
  autoComplete = 'new-password',
  placeholder,
  showLabel,
  hideLabel,
  describedBy,
}: PasswordFieldProps) {
  const field = useFieldContext<string>();
  const state = useFieldErrors(description, describedBy);
  const { isInvalid, describedBy: ariaDescribedBy } = state;
  const [visible, setVisible] = useState(false);

  return (
    <FieldFrame
      description={description}
      disabled={disabled}
      label={label}
      layout={layout}
      required={required}
      state={state}
    >
      <InputGroup>
        <InputGroupInput
          aria-describedby={ariaDescribedBy}
          aria-invalid={isInvalid}
          aria-required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          id={field.name}
          name={field.name}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          placeholder={placeholder}
          type={visible ? 'text' : 'password'}
          value={field.state.value}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={visible ? hideLabel : showLabel}
            disabled={disabled}
            onClick={() => setVisible((shown) => !shown)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </FieldFrame>
  );
}

type ChoiceCardProps = {
  /** The control's id, so a click anywhere on the card reaches it. */
  htmlFor?: string;
  label: ReactNode;
  /** Text goes in a description line; any other node, such as a skeleton, is placed as it is. */
  description?: ReactNode;
  disabled?: boolean;
  /** The switch or radio, or a placeholder while loading. */
  children: ReactNode;
  media?: ReactNode;
};

/** The card around one choice: label and description at the start, the control at the end. */
export function ChoiceCard({
  htmlFor,
  label,
  description,
  disabled,
  children,
  media,
}: ChoiceCardProps) {
  return (
    <FieldLabel htmlFor={htmlFor}>
      <Field data-disabled={disabled} orientation="horizontal">
        {media}
        <FieldContent>
          <FieldTitle>{label}</FieldTitle>
          {typeof description === 'string' ? (
            <FieldDescription>{description}</FieldDescription>
          ) : (
            description
          )}
        </FieldContent>
        {children}
      </Field>
    </FieldLabel>
  );
}

type SwitchFieldProps = Omit<FieldProps, 'required'> & Pick<FieldFrameProps, 'badge' | 'action'>;

/** A yes/no setting as a `ChoiceCard`, all one click target, or the switch alone in a row or a cell. */
export function SwitchField({
  label,
  description,
  disabled,
  layout,
  badge,
  action,
}: SwitchFieldProps) {
  const field = useFieldContext<boolean>();
  const { descriptionId, badgeId, describedBy } = useFieldErrors(description, undefined, badge);
  const control = (
    <Switch
      aria-describedby={layout === 'row' ? describedBy : undefined}
      checked={field.state.value}
      disabled={disabled}
      id={field.name}
      name={field.name}
      onBlur={field.handleBlur}
      onCheckedChange={(checked) => field.handleChange(checked)}
    />
  );

  if (layout === 'row') {
    return (
      <Field data-disabled={disabled}>
        <SettingsRowFrame
          badge={badge && <span id={badgeId}>{badge}</span>}
          description={
            description && <FieldDescription id={descriptionId}>{description}</FieldDescription>
          }
          label={
            <FieldLabel htmlFor={field.name} weight="normal">
              {label}
            </FieldLabel>
          }
        >
          <div className="flex items-center gap-2">
            {action}
            {control}
          </div>
        </SettingsRowFrame>
      </Field>
    );
  }
  if (layout === 'inline') {
    return (
      <Field data-disabled={disabled} orientation="horizontal">
        <HiddenFromView>
          <label htmlFor={field.name}>{label}</label>
        </HiddenFromView>
        {control}
      </Field>
    );
  }
  return (
    <ChoiceCard description={description} disabled={disabled} htmlFor={field.name} label={label}>
      {control}
    </ChoiceCard>
  );
}

type ImageFieldProps = Omit<FieldProps, 'layout' | 'required'> & {
  accept: string;
  previewUrl: string;
  previewAlt: string;
  chooseLabel: string;
  removeLabel: string;
  canRemove: boolean;
};

export function ImageField({
  label,
  description,
  disabled,
  accept,
  previewUrl,
  previewAlt,
  chooseLabel,
  removeLabel,
  canRemove,
}: ImageFieldProps) {
  const field = useFieldContext<File | null | undefined>();
  const input = useRef<HTMLInputElement>(null);
  const choose = useRef<HTMLButtonElement>(null);
  const state = useFieldErrors(description);

  return (
    <FieldFrame
      description={description}
      disabled={disabled}
      label={label}
      layout="row"
      state={state}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="flex h-10 w-24 items-center justify-center overflow-hidden rounded-md border bg-background p-1">
          <img alt={previewAlt} className="max-h-full max-w-full object-contain" src={previewUrl} />
        </span>
        <input
          accept={accept}
          aria-describedby={state.describedBy}
          aria-invalid={state.isInvalid}
          className="sr-only"
          disabled={disabled}
          id={field.name}
          name={field.name}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) field.handleChange(file);
            event.target.value = '';
          }}
          ref={input}
          tabIndex={-1}
          type="file"
        />
        <Button
          aria-describedby={state.describedBy}
          aria-invalid={state.isInvalid}
          disabled={disabled}
          onClick={() => input.current?.click()}
          ref={choose}
          size="sm"
          type="button"
          variant="outline"
        >
          {chooseLabel}
        </Button>
        {canRemove && (
          <Button
            disabled={disabled}
            onClick={() => {
              field.handleChange(null);
              choose.current?.focus();
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {removeLabel}
          </Button>
        )}
      </div>
    </FieldFrame>
  );
}

export type RadioGroupFieldOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  media?: ReactNode;
};

type RadioGroupFieldProps = {
  /** Names the group; shown above the options. */
  label: ReactNode;
  options: readonly RadioGroupFieldOption[];
  disabled?: boolean;
  columns?: 'fill';
};

/** One choice from a few, each drawn as a card like `SwitchField`. */
export function RadioGroupField({ label, options, disabled, columns }: RadioGroupFieldProps) {
  const field = useFieldContext<string>();

  return (
    <FieldSet>
      <FieldLegend id={`${field.name}-legend`} variant="label">
        {label}
      </FieldLegend>
      <RadioGroup
        aria-labelledby={`${field.name}-legend`}
        columns={columns}
        disabled={disabled}
        name={field.name}
        onBlur={field.handleBlur}
        onValueChange={(value) => field.handleChange(String(value))}
        value={field.state.value}
      >
        {options.map((option) => {
          const id = `${field.name}-${option.value}`;
          return (
            <ChoiceCard
              description={option.description}
              disabled={disabled}
              htmlFor={id}
              key={option.value}
              label={option.label}
              media={option.media}
            >
              <RadioGroupItem id={id} value={option.value} />
            </ChoiceCard>
          );
        })}
      </RadioGroup>
    </FieldSet>
  );
}

export type SelectFieldItem = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectFieldProps = FieldProps &
  Pick<FieldFrameProps, 'badge' | 'action'> & {
    items: readonly SelectFieldItem[];
  };

/** One of a short, fixed list; the field's value is the item's `value`. */
export function SelectField({
  label,
  description,
  required,
  disabled,
  layout,
  items,
  badge,
  action,
}: SelectFieldProps) {
  const field = useFieldContext<string>();
  const state = useFieldErrors(description, undefined, badge);
  const { isInvalid, describedBy: ariaDescribedBy } = state;

  return (
    <FieldFrame
      action={action}
      badge={badge}
      description={description}
      disabled={disabled}
      label={label}
      layout={layout}
      required={required}
      state={state}
    >
      <Select
        disabled={disabled}
        items={items}
        onValueChange={(value) => value !== null && field.handleChange(value)}
        value={field.state.value}
      >
        <SelectTrigger
          aria-describedby={ariaDescribedBy}
          aria-invalid={isInvalid}
          aria-required={required}
          id={field.name}
          onBlur={field.handleBlur}
          width="full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem disabled={item.disabled} key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldFrame>
  );
}

export type ComboboxFieldItem = {
  value: string;
  label: string;
};

type ComboboxFieldProps = FieldProps & {
  items: readonly ComboboxFieldItem[];
  placeholder?: string;
  emptyMessage: ReactNode;
  /** Names the button that empties the field, for screen readers. */
  clearLabel: string;
  /** Most matches rendered at once, so a list of thousands stays quick to type into. */
  limit?: number;
};

/** Picks one item by typing to filter; the field's value is the item's `value`, or null for none. */
export function ComboboxField({
  label,
  layout,
  description,
  required,
  disabled,
  items,
  placeholder,
  emptyMessage,
  clearLabel,
  limit = 50,
}: ComboboxFieldProps) {
  const field = useFieldContext<string | null>();
  const state = useFieldErrors(description);
  const { isInvalid, describedBy: ariaDescribedBy } = state;
  const selected = useMemo(
    () => items.find((item) => item.value === field.state.value) ?? null,
    [items, field.state.value],
  );

  return (
    <FieldFrame
      description={description}
      disabled={disabled}
      label={label}
      layout={layout}
      required={required}
      state={state}
    >
      <Combobox
        disabled={disabled}
        isItemEqualToValue={(item, value) => item.value === value.value}
        itemToStringLabel={(item) => item.label}
        items={items}
        limit={limit}
        onValueChange={(item, details) => {
          // Base UI clears the field on Escape once the list is closed; let Escape close the dialog instead.
          if (details.reason === 'escape-key' && !item) return details.allowPropagation();
          field.handleChange(item?.value ?? null);
        }}
        value={selected}
      >
        <ComboboxInput
          aria-describedby={ariaDescribedBy}
          aria-invalid={isInvalid}
          aria-required={required}
          clearLabel={clearLabel}
          disabled={disabled}
          id={field.name}
          onBlur={field.handleBlur}
          placeholder={placeholder}
          showClear={selected !== null}
          width="full"
        />
        <ComboboxContent>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(item: ComboboxFieldItem) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </FieldFrame>
  );
}

type MultiComboboxFieldProps = FieldProps & {
  items: readonly ComboboxFieldItem[];
  placeholder?: string;
  emptyMessage: ReactNode;
  removeLabel: (label: string) => string;
};

export function MultiComboboxField({
  label,
  layout,
  description,
  required,
  disabled,
  items,
  placeholder,
  emptyMessage,
  removeLabel,
}: MultiComboboxFieldProps) {
  const field = useFieldContext<string[]>();
  const state = useFieldErrors(description);
  const { isInvalid, describedBy: ariaDescribedBy } = state;
  const anchor = useComboboxAnchor();
  const selected = useMemo(() => {
    const chosen = new Set(field.state.value);
    return items.filter((item) => chosen.has(item.value));
  }, [items, field.state.value]);

  return (
    <FieldFrame
      description={description}
      disabled={disabled}
      label={label}
      layout={layout}
      required={required}
      state={state}
    >
      <Combobox
        disabled={disabled}
        isItemEqualToValue={(item, value) => item.value === value.value}
        itemToStringLabel={(item) => item.label}
        items={items}
        multiple
        onValueChange={(chosen, details) => {
          if (details.reason === 'escape-key' && chosen.length === 0)
            return details.allowPropagation();
          field.handleChange(chosen.map((item) => item.value));
        }}
        value={selected}
      >
        <ComboboxChips ref={anchor}>
          <ComboboxValue>
            {(values: ComboboxFieldItem[]) => (
              <>
                {values.map((item) => (
                  <ComboboxChip key={item.value} removeLabel={removeLabel(item.label)}>
                    {item.label}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  aria-describedby={ariaDescribedBy}
                  aria-invalid={isInvalid}
                  aria-required={required}
                  disabled={disabled}
                  id={field.name}
                  onBlur={field.handleBlur}
                  placeholder={values.length === 0 ? placeholder : undefined}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(item: ComboboxFieldItem) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </FieldFrame>
  );
}
