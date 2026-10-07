import { useStore } from '@tanstack/react-form';
import {
  CalendarIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { formatDateValue, parseDateValue, toDateValue } from '@/components/form/date-value';
import { useFieldContext } from '@/components/form/form-context';
import { useAboutLabel, useDateMessages, useFormatError } from '@/components/form/form-messages';
import { type QuantityValue, updateQuantityValue } from '@/components/form/quantity-value';
import { SettingsRowFrame } from '@/components/form/settings-list';
import { addTag, type TagRefusal, tagSuggestions } from '@/components/form/tags';
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
import { useDirection } from '@/components/ui/direction';
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
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  /** After the badge in a row, or at the end of a stacked label's line, such as a Reset or a link. */
  action?: ReactNode;
  state: ReturnType<typeof useFieldErrors>;
  /** `end` lines a row's error up with a value set at the end, such as an image preview. */
  errorAlign?: 'end';
  /** The control, which takes the field's name as its id. */
  children: ReactNode;
};

/** The field's errors as display text, whether there are any, and what the control is described by. */
function useFieldErrors(
  description?: ReactNode,
  extraDescribedBy?: string,
  badge?: ReactNode,
  nestedErrors: readonly unknown[] = [],
) {
  const field = useFieldContext<unknown>();
  const formatError = useFormatError();
  const errors = [...field.state.meta.errors, ...nestedErrors].map((error: unknown) => ({
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

function RowExtras({
  badge,
  badgeId,
  action,
}: Pick<FieldFrameProps, 'badge' | 'action'> & { badgeId: string }) {
  return (
    <>
      {badge && <span id={badgeId}>{badge}</span>}
      {action}
    </>
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
  errorAlign,
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
          badge={<RowExtras action={action} badge={badge} badgeId={badgeId} />}
          description={descriptionNode}
          label={
            <FieldLabel htmlFor={field.name} id={`${field.name}-label`} weight="normal">
              {labelText}
            </FieldLabel>
          }
          value="control"
        >
          {children}
          {isInvalid && (
            <div className={errorAlign === 'end' ? 'text-end' : undefined}>
              <FieldError errors={errors} id={errorId} />
            </div>
          )}
        </SettingsRowFrame>
      </Field>
    );
  }
  if (layout === 'inline') {
    return (
      <Field data-disabled={disabled} data-invalid={isInvalid} spacing="tight">
        <HiddenFromView>
          <label htmlFor={field.name} id={`${field.name}-label`}>
            {labelText}
          </label>
        </HiddenFromView>
        {children}
        {details}
      </Field>
    );
  }
  const stackedLabel = (
    <FieldLabel htmlFor={field.name} id={`${field.name}-label`}>
      {labelText}
    </FieldLabel>
  );
  return (
    <Field data-disabled={disabled} data-invalid={isInvalid} spacing="tight">
      {action ? (
        // Beside the label on screen, after the input in tab order, and wrapping when cramped.
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="shrink-0">{stackedLabel}</div>
          <div className="order-last basis-full">{children}</div>
          <div className="ms-auto">{action}</div>
        </div>
      ) : (
        <>
          {stackedLabel}
          {children}
        </>
      )}
      {details}
    </Field>
  );
}

type TextFieldProps = FieldProps &
  Pick<FieldFrameProps, 'badge'> & {
    type?: 'text' | 'email' | 'tel' | 'time';
    autoComplete?: string;
    placeholder?: string;
    maxLength?: number;
    /** `ltr` for codes and phone numbers; `auto` for free text that may be in another script. */
    dir?: 'ltr' | 'auto';
    inputMode?: 'numeric' | 'decimal';
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
  maxLength,
  dir,
  inputMode,
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
        inputMode={inputMode}
        maxLength={maxLength}
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

export function NumberField(props: FieldProps) {
  return <TextField {...props} autoComplete="off" dir="ltr" inputMode="numeric" />;
}

type QuantityFieldProps = FieldProps & {
  unit: 'DOSES' | 'PACKS';
  netContent?: number | null;
  packsLabel: ReactNode;
  dosesLabel: ReactNode;
};

export function QuantityField({
  label,
  layout,
  description,
  required,
  disabled,
  unit,
  netContent,
  packsLabel,
  dosesLabel,
}: QuantityFieldProps) {
  const field = useFieldContext<QuantityValue>();
  const nestedErrors = useStore(field.form.store, (state) =>
    ['doses', 'packs', 'remainder'].map((part) => state.fieldMeta[`${field.name}.${part}`]?.errors),
  );
  const state = useFieldErrors(
    description,
    undefined,
    undefined,
    nestedErrors.flat().filter(Boolean),
  );
  const labelId = `${field.name}-label`;
  const parts: (keyof QuantityValue)[] = unit === 'DOSES' ? ['doses'] : ['packs', 'remainder'];

  return (
    <FieldFrame
      description={description}
      disabled={disabled}
      label={label}
      layout={layout}
      required={required}
      state={state}
    >
      <div className="flex min-w-0 gap-2">
        {parts.map((part, index) => {
          const partId = `${field.name}-${part}-label`;
          return (
            <div className="min-w-0 flex-1" key={part}>
              {unit === 'PACKS' && (
                <HiddenFromView>
                  <label htmlFor={index === 0 ? field.name : `${field.name}-${part}`} id={partId}>
                    {part === 'packs' ? packsLabel : dosesLabel}
                  </label>
                </HiddenFromView>
              )}
              <Input
                aria-describedby={state.describedBy}
                aria-invalid={state.isInvalid}
                aria-labelledby={unit === 'PACKS' ? `${labelId} ${partId}` : labelId}
                aria-required={required}
                autoComplete="off"
                dir="ltr"
                disabled={disabled}
                id={index === 0 ? field.name : `${field.name}-${part}`}
                inputMode="numeric"
                name={`${field.name}.${part}`}
                onBlur={field.handleBlur}
                onChange={(event) =>
                  field.handleChange(
                    updateQuantityValue(field.state.value, part, event.target.value, netContent),
                  )
                }
                value={field.state.value[part]}
              />
            </div>
          );
        })}
      </div>
    </FieldFrame>
  );
}

export function DecimalField(props: FieldProps) {
  return <TextField {...props} autoComplete="off" dir="ltr" inputMode="decimal" />;
}

type TextareaFieldProps = FieldProps & {
  placeholder?: string;
  dir?: 'auto';
};

export function TextareaField({
  label,
  layout,
  description,
  required,
  disabled,
  placeholder,
  dir,
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
        dir={dir}
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

type PasswordFieldProps = FieldProps &
  Pick<FieldFrameProps, 'action'> & {
    autoComplete?: 'new-password' | 'current-password';
    placeholder?: string;
    /** Names the button that reveals the password, for screen readers. */
    showLabel: string;
    hideLabel: string;
    describedBy?: string;
  } & SharedVisibility;

/** Both or neither, for fields that show and hide together, such as a password and its confirmation. */
type SharedVisibility =
  | { visible?: never; onVisibleChange?: never }
  | { visible: boolean; onVisibleChange: (visible: boolean) => void };

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
  visible: sharedVisible,
  onVisibleChange,
  action,
}: PasswordFieldProps) {
  const field = useFieldContext<string>();
  const state = useFieldErrors(description, describedBy);
  const { isInvalid, describedBy: ariaDescribedBy } = state;
  const [ownVisible, setOwnVisible] = useState(false);
  const visible = sharedVisible ?? ownVisible;

  return (
    <FieldFrame
      action={action}
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
            onClick={() => (onVisibleChange ?? setOwnVisible)(!visible)}
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

/** A small option: its media across the top, the label and the control below. */
function ChoiceTile({
  htmlFor,
  label,
  disabled,
  children,
  media,
}: Omit<ChoiceCardProps, 'description'>) {
  return (
    <FieldLabel htmlFor={htmlFor}>
      <Field data-disabled={disabled}>
        {media}
        <div className="flex items-center justify-between gap-2">
          <FieldTitle>{label}</FieldTitle>
          {children}
        </div>
      </Field>
    </FieldLabel>
  );
}

type SwitchFieldProps = Omit<FieldProps, 'required' | 'label'> &
  Pick<FieldFrameProps, 'action'> & { label: string };

/** An info button that shows a field's description in a popover. */
function FieldAbout({ label, description }: { label: string; description: ReactNode }) {
  const aboutLabel = useAboutLabel();
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button aria-label={aboutLabel(label)} size="icon-xs" type="button" variant="ghost" />
        }
      >
        <InfoIcon />
      </PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>{label}</PopoverTitle>
          <PopoverDescription>{description}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

/** A yes/no setting: label and info button at the start, the switch at the end, or the switch alone in a cell. */
export function SwitchField({ label, description, disabled, layout, action }: SwitchFieldProps) {
  const field = useFieldContext<boolean>();
  const { descriptionId, badgeId, describedBy } = useFieldErrors(description);
  const control = (
    <Switch
      aria-describedby={layout === 'inline' ? undefined : describedBy}
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
          badge={<RowExtras action={action} badgeId={badgeId} />}
          description={
            description && <FieldDescription id={descriptionId}>{description}</FieldDescription>
          }
          label={
            <FieldLabel htmlFor={field.name} weight="normal">
              {label}
            </FieldLabel>
          }
        >
          {control}
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
    <Field data-disabled={disabled} orientation="horizontal">
      <div className="flex min-h-8 min-w-0 flex-1 items-center gap-1">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description && (
          <>
            <FieldAbout description={description} label={label} />
            <span className="sr-only" id={descriptionId}>
              {description}
            </span>
          </>
        )}
      </div>
      {control}
    </Field>
  );
}

type IconActionProps = Omit<ComponentProps<typeof Button>, 'children' | 'size' | 'type'> & {
  label: string;
  icon: ReactNode;
};

/** An icon button named by `label`, which its tooltip shows too. */
function IconAction({ label, icon, ...props }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button aria-label={label} size="icon-xs" type="button" {...props} />}
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
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

  const actions = (
    <span className="flex items-center gap-1">
      <IconAction
        aria-describedby={state.describedBy}
        aria-invalid={state.isInvalid}
        disabled={disabled}
        icon={<UploadIcon />}
        label={chooseLabel}
        onClick={() => input.current?.click()}
        ref={choose}
        variant="outline"
      />
      {canRemove && (
        <IconAction
          disabled={disabled}
          icon={<Trash2Icon />}
          label={removeLabel}
          onClick={() => {
            field.handleChange(null);
            choose.current?.focus();
          }}
          variant="destructive"
        />
      )}
    </span>
  );

  return (
    <FieldFrame
      action={actions}
      description={description}
      disabled={disabled}
      errorAlign="end"
      label={label}
      layout="row"
      state={state}
    >
      <div className="flex justify-end">
        <img alt={previewAlt} className="h-10 max-w-32 object-contain" src={previewUrl} />
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
      </div>
    </FieldFrame>
  );
}

export type RadioGroupFieldOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  media?: ReactNode;
  disabled?: boolean;
};

type RadioGroupFieldProps = {
  /** Names the group; shown above the options. */
  label: ReactNode;
  options: readonly RadioGroupFieldOption[];
  disabled?: boolean;
  /** `row` puts the cards side by side once there is room. */
  columns?: 'row';
  /** `tile` puts the media above the label, in a grid of small options such as colours; `segmented` is a compact row of a few short options. */
  variant?: 'card' | 'tile' | 'segmented';
};

/** One choice from a few, each drawn as a card, or as a small tile. */
export function RadioGroupField({
  label,
  options,
  disabled,
  columns,
  variant = 'card',
}: RadioGroupFieldProps) {
  const field = useFieldContext<string>();

  if (variant === 'segmented') {
    return (
      <Field data-disabled={disabled} spacing="tight">
        <span className="font-medium text-sm leading-snug" id={`${field.name}-legend`}>
          {label}
        </span>
        <RadioGroup
          aria-labelledby={`${field.name}-legend`}
          disabled={disabled}
          name={field.name}
          onBlur={field.handleBlur}
          onValueChange={(value) => field.handleChange(String(value))}
          value={field.state.value}
          variant="segmented"
        >
          {options.map((option) => (
            <RadioGroupItem
              disabled={option.disabled}
              key={option.value}
              value={option.value}
              variant="segmented"
            >
              {option.label}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </Field>
    );
  }

  return (
    <FieldSet>
      <FieldLegend id={`${field.name}-legend`} variant="label">
        {label}
      </FieldLegend>
      <RadioGroup
        aria-labelledby={`${field.name}-legend`}
        columns={variant === 'tile' ? 'tiles' : columns}
        disabled={disabled}
        name={field.name}
        onBlur={field.handleBlur}
        onValueChange={(value) => field.handleChange(String(value))}
        value={field.state.value}
      >
        {options.map((option) => {
          const id = `${field.name}-${option.value}`;
          if (variant === 'tile') {
            return (
              <ChoiceTile
                disabled={disabled || option.disabled}
                htmlFor={id}
                key={option.value}
                label={option.label}
                media={option.media}
              >
                <RadioGroupItem disabled={option.disabled} id={id} value={option.value} />
              </ChoiceTile>
            );
          }
          return (
            <ChoiceCard
              description={option.description}
              disabled={disabled || option.disabled}
              htmlFor={id}
              key={option.value}
              label={option.label}
              media={option.media}
            >
              <RadioGroupItem disabled={option.disabled} id={id} value={option.value} />
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
  Pick<FieldFrameProps, 'action'> & {
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
  action,
}: SelectFieldProps) {
  const field = useFieldContext<string>();
  const state = useFieldErrors(description);
  const { isInvalid, describedBy: ariaDescribedBy } = state;

  return (
    <FieldFrame
      action={action}
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
        <SelectContent alignItemWithTrigger={false}>
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
  description?: string;
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
          showClear={selected !== null && !disabled}
          width="full"
        />
        <ComboboxContent>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(item: ComboboxFieldItem) => (
              <ComboboxItem key={item.value} value={item}>
                <span className="min-w-0 truncate" dir="auto">
                  {item.label}
                </span>
                {item.description && (
                  <span className="ms-auto shrink-0 text-muted-foreground text-xs">
                    {item.description}
                  </span>
                )}
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
                    <span dir="auto">{item.label}</span>
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
                <span dir="auto">{item.label}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </FieldFrame>
  );
}

type TagsFieldProps = FieldProps & {
  suggestions: readonly string[];
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  removeLabel: (tag: string) => string;
  refusedMessage: (reason: TagRefusal) => string;
};

const isTagSeparator = (key: string) => key === ',' || key === '،';

/** Enter, Tab or leaving the box takes the highlighted suggestion or the typed text; a comma, the typed text. */
export function TagsField({
  label,
  layout,
  description,
  required,
  disabled,
  suggestions,
  placeholder,
  minLength,
  maxLength,
  removeLabel,
  refusedMessage,
}: TagsFieldProps) {
  const field = useFieldContext<string[]>();
  const refusedId = `${field.name}-refused`;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [refusal, setRefusal] = useState<TagRefusal>();
  const highlighted = useRef<string | undefined>(undefined);
  const state = useFieldErrors(description, refusal ? refusedId : undefined);
  const { isInvalid, describedBy: ariaDescribedBy } = state;
  const anchor = useComboboxAnchor();
  const tags = field.state.value;
  const items = useMemo(() => tagSuggestions(suggestions, tags, text), [suggestions, tags, text]);
  const listOpen = open && items.length > 0;
  const suggested = () =>
    listOpen && highlighted.current && items.includes(highlighted.current)
      ? highlighted.current
      : undefined;

  const add = (next: string) => {
    const result = addTag(tags, next, { min: minLength, max: maxLength });
    if (!result) return;
    if ('refused' in result) {
      setRefusal(result.refused);
      return;
    }
    field.handleChange(result.tags);
    setText('');
  };

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
        autoHighlight
        disabled={disabled}
        filter={null}
        inputValue={text}
        items={items}
        multiple
        onInputValueChange={(value, details) => {
          // Base UI empties the box on Enter and on closing; refused text stays, as in legacy.
          if (details.reason === 'input-clear') return;
          setText(value);
          setRefusal(undefined);
        }}
        onItemHighlighted={(item) => {
          highlighted.current = item;
        }}
        onOpenChange={setOpen}
        onValueChange={(next) => {
          field.handleChange(next);
          setText('');
          setRefusal(undefined);
        }}
        open={listOpen}
        value={tags}
      >
        <ComboboxChips ref={anchor}>
          <ComboboxValue>
            {(values: string[]) => (
              <>
                {values.map((tag) => (
                  <ComboboxChip key={tag} removeLabel={removeLabel(tag)}>
                    <span className="truncate" dir="auto" title={tag}>
                      {tag}
                    </span>
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  aria-describedby={ariaDescribedBy}
                  aria-invalid={isInvalid || refusal !== undefined}
                  aria-required={required}
                  disabled={disabled}
                  id={field.name}
                  onBlur={(event) => {
                    // A click on a suggestion moves focus into the list, and picks it there.
                    const clicked = event.relatedTarget?.closest('[data-slot="combobox-content"]');
                    if (!clicked) add(suggested() ?? text);
                    field.handleBlur();
                  }}
                  onKeyDown={(event) => {
                    const separator = isTagSeparator(event.key);
                    if (!separator && (event.key !== 'Enter' || suggested() || !text.trim()))
                      return;
                    event.preventDefault();
                    add(text);
                  }}
                  placeholder={values.length === 0 ? placeholder : undefined}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                <span dir="auto">{item}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {refusal && <FieldError errors={[{ message: refusedMessage(refusal) }]} id={refusedId} />}
    </FieldFrame>
  );
}

type DateFieldProps = FieldProps & {
  placeholder: string;
  clearLabel?: string;
  earliest?: string;
  latest?: string;
};

type CalendarComponent = typeof import('@/components/ui/calendar').Calendar;

type LoadedCalendar = {
  Calendar: CalendarComponent;
  locale: ComponentProps<CalendarComponent>['locale'];
};

const FIRST_MONTH = new Date(1900, 0);
const lastMonth = () => new Date(new Date().getFullYear() + 20, 11);

/** Narrow, since a day column is too small for the full name in many languages. */
const weekdayName = (date: Date, locale: string) =>
  date.toLocaleDateString(locale, { weekday: 'narrow' });

export function DateField({
  label,
  layout,
  description,
  required,
  disabled,
  placeholder,
  clearLabel,
  earliest,
  latest,
}: DateFieldProps) {
  const field = useFieldContext<string>();
  const state = useFieldErrors(description);

  return (
    <FieldFrame
      description={description}
      disabled={disabled}
      label={label}
      layout={layout}
      required={required}
      state={state}
    >
      <DatePicker
        clearLabel={clearLabel}
        earliest={earliest}
        latest={latest}
        describedBy={state.describedBy}
        disabled={disabled}
        id={field.name}
        invalid={state.isInvalid}
        onBlur={field.handleBlur}
        onValueChange={field.handleChange}
        placeholder={placeholder}
        required={required}
        value={field.state.value}
      />
    </FieldFrame>
  );
}

type DatePickerProps = {
  id: string;
  /** `yyyy-MM-dd`, or an empty string for no date. */
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  /** Names the picker where no field label does, as in a toolbar; shown before a picked date. */
  label?: string | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Shows a clear button while a date is picked, unless the date is required. */
  clearLabel?: string | undefined;
  /** The first and last days that can be picked, as `yyyy-MM-dd`. */
  earliest?: string | undefined;
  latest?: string | undefined;
  invalid?: boolean | undefined;
  describedBy?: string | undefined;
  onBlur?: (() => void) | undefined;
};

/** A date picked from a calendar, shown in the page's language; the calendar loads as it mounts. */
export function DatePicker({
  id,
  value,
  onValueChange,
  placeholder,
  label,
  required,
  disabled,
  clearLabel,
  earliest,
  latest,
  invalid,
  describedBy,
  onBlur,
}: DatePickerProps) {
  const labelId = `${id}-label`;
  const requiredId = `${id}-required`;
  const valueId = `${id}-value`;
  const { requiredLabel, dateLanguage, loadDateLocale } = useDateMessages();
  const direction = useDirection();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<LoadedCalendar | null>(null);
  const selected = parseDateValue(value);
  const shown = formatDateValue(value, dateLanguage);
  const clearable = Boolean(clearLabel && !required);
  const canClear = clearable && Boolean(shown) && !disabled;
  const first = earliest ? parseDateValue(earliest) : undefined;
  const last = latest ? parseDateValue(latest) : undefined;
  const mounted = useRef(true);

  const loadCalendar = useCallback(
    () =>
      Promise.all([import('@/components/ui/calendar'), loadDateLocale?.()])
        .then(([module, locale]) => {
          if (mounted.current) setLoaded({ Calendar: module.Calendar, locale });
        })
        .catch(() => undefined),
    [loadDateLocale],
  );

  useEffect(() => {
    mounted.current = true;
    void loadCalendar();
    return () => {
      mounted.current = false;
    };
  }, [loadCalendar]);

  return (
    <div className="relative">
      <Popover
        onOpenChange={(next) => {
          setOpen(next);
          // A calendar that failed to load is tried again when the user asks for it.
          if (next && !loaded) void loadCalendar();
        }}
        open={open && loaded !== null}
      >
        <PopoverTrigger
          render={
            <Button
              align="start"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              aria-labelledby={[labelId, required ? requiredId : '', shown || !label ? valueId : '']
                .filter(Boolean)
                .join(' ')}
              disabled={disabled}
              id={id}
              onBlur={onBlur}
              ref={trigger}
              type="button"
              variant="outline"
              width="full"
            />
          }
        >
          <CalendarIcon data-icon="inline-start" />
          {required && (
            <span className="sr-only" id={requiredId}>
              {requiredLabel}
            </span>
          )}
          <span className={canClear ? 'flex min-w-0 gap-1 pe-6' : 'flex min-w-0 gap-1'}>
            {label && (
              <span className={shown ? 'shrink-0 text-muted-foreground' : 'sr-only'} id={labelId}>
                {shown ? `${label}:` : label}
              </span>
            )}
            <span
              className={shown ? 'min-w-0 truncate' : 'min-w-0 truncate text-muted-foreground'}
              id={valueId}
            >
              {shown || placeholder}
            </span>
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" aria-labelledby={labelId} padding="none" width="auto">
          {loaded && (
            <loaded.Calendar
              autoFocus
              captionLayout="dropdown"
              defaultMonth={selected ?? first ?? last}
              dir={direction}
              disabled={[...(first ? [{ before: first }] : []), ...(last ? [{ after: last }] : [])]}
              endMonth={lastMonth()}
              formatters={{ formatWeekdayName: (date) => weekdayName(date, dateLanguage) }}
              locale={loaded.locale}
              mode="single"
              onSelect={(date: Date | undefined) => {
                onValueChange(date ? toDateValue(date) : '');
                setOpen(false);
              }}
              required={!clearable}
              selected={selected}
              startMonth={FIRST_MONTH}
            />
          )}
        </PopoverContent>
      </Popover>
      {/* A sibling of the trigger, since a button cannot hold another button. */}
      {canClear && (
        <div className="absolute inset-y-0 end-1 flex items-center">
          <Button
            aria-label={clearLabel}
            onClick={() => {
              onValueChange('');
              trigger.current?.focus();
            }}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
