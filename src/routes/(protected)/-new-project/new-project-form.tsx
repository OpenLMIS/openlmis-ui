import { useForm, useStore } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { parseISO } from 'date-fns';
import { Loader2Icon } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { ConfirmResetButton } from '@/components/confirm-reset-button';
import { DateField } from '@/components/date-field';
import { RadioCardGroup, type RadioCardOption } from '@/components/radio-card-group';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { CreateProjectError, createProject } from '@/features/new-project/api/api';
import {
  DEFAULT_NEW_PROJECT,
  newProjectSchema,
  PROJECT_NOTIFY_EVENTS,
  PROJECT_STATUSES,
  type ProjectNotifyEvent,
  type ProjectPriority,
  type ProjectVisibility,
  slugify,
} from '@/features/new-project/lib/types';
import { OwnerCombobox } from '@/routes/(protected)/-new-project/owner-combobox';

const FORM_ID = 'new-project-form';
const DESCRIPTION_MAX = 500;

const PRIORITY_OPTIONS: readonly RadioCardOption<ProjectPriority>[] = [
  { value: 'Low', label: 'Low', description: 'Fit it in when convenient.' },
  { value: 'Medium', label: 'Medium', description: 'Standard team cadence.' },
  { value: 'High', label: 'High', description: 'Ship this sprint.' },
  { value: 'Critical', label: 'Critical', description: 'Block everything else.' },
] as const;

const VISIBILITY_OPTIONS: readonly RadioCardOption<ProjectVisibility>[] = [
  { value: 'Private', label: 'Private', description: 'Only you can see this project.' },
  { value: 'Team', label: 'Team', description: 'Visible to everyone on your team.' },
  { value: 'Public', label: 'Public', description: 'Visible to anyone with the link.' },
] as const;

const NOTIFY_LABELS: Record<ProjectNotifyEvent, { label: string; description: string }> = {
  created: { label: 'Project created', description: 'Initial setup and kickoff.' },
  updates: { label: 'Status updates', description: 'Progress, blockers, and daily pulse.' },
  milestones: { label: 'Milestone reached', description: 'Every time a phase closes.' },
  completed: { label: 'Project completed', description: 'Final delivery and handoff.' },
};

export function NewProjectForm() {
  const navigate = useNavigate();
  /*
    Track whether the user has manually edited the slug. Until they do,
    the slug mirrors a slugified version of the name so the common case
    is a single keystroke. On Reset this flips back to false.
  */
  const slugTouchedRef = useRef(false);

  const form = useForm({
    defaultValues: DEFAULT_NEW_PROJECT,
    validators: { onSubmit: newProjectSchema },
    onSubmit: async ({ value }) => {
      try {
        await createProject(value);
        toast.success('Project created.');
        await navigate({ to: '/dashboard' });
      } catch (error) {
        if (error instanceof CreateProjectError) {
          toast.error(error.message);
        } else {
          toast.error('Something went wrong. Please try again.');
        }
      }
    },
  });

  /*
    Watch startDate via useStore so the dueDate Calendar's `disabled`
    function rebuilds when it changes. useStore re-renders only this
    component on selector-result change; useMemo keeps the closure
    identity stable between unrelated renders.
  */
  const startDate = useStore(form.store, (state) => state.values.startDate);
  const dueDateDisabled = useMemo(
    () => (date: Date) => (startDate ? date < parseISO(startDate) : false),
    [startDate],
  );

  function handleReset() {
    slugTouchedRef.current = false;
    form.reset();
  }

  return (
    <Card surface="background">
      <CardHeader>
        <CardTitle>New project</CardTitle>
        <CardDescription>
          Set up a project, assign an owner, and pick scheduling + visibility rules.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          id={FORM_ID}
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          noValidate
        >
          <FieldGroup>
            <FieldGroup data-slot="field-group" className="grid @md/field-group:grid-cols-2">
              <form.Field name="name">
                {(field) => {
                  const isInvalid = field.state.meta.errors.length > 0;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Project name</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onChange={(e) => {
                          const next = e.target.value;
                          field.handleChange(next);
                          if (!slugTouchedRef.current) {
                            form.setFieldValue('slug', slugify(next));
                          }
                        }}
                        onBlur={field.handleBlur}
                        placeholder="Acme redesign"
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="slug">
                {(field) => {
                  const isInvalid = field.state.meta.errors.length > 0;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>URL slug</FieldLabel>
                      <InputGroup>
                        <InputGroupAddon align="inline-start">app.soldevelo.com/</InputGroupAddon>
                        <InputGroupInput
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onChange={(e) => {
                            slugTouchedRef.current = true;
                            field.handleChange(e.target.value);
                          }}
                          onBlur={field.handleBlur}
                          placeholder="acme-redesign"
                          aria-invalid={isInvalid}
                        />
                      </InputGroup>
                      {isInvalid ? (
                        <FieldError errors={field.state.meta.errors} />
                      ) : (
                        <FieldDescription>
                          Auto-filled from the name. Edit to override.
                        </FieldDescription>
                      )}
                    </Field>
                  );
                }}
              </form.Field>
            </FieldGroup>

            <form.Field name="description">
              {(field) => {
                const isInvalid = field.state.meta.errors.length > 0;
                const remaining = DESCRIPTION_MAX - field.state.value.length;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="Short summary of the project scope and goals."
                      rows={4}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : (
                      <FieldDescription>
                        Optional. {remaining} character{remaining === 1 ? '' : 's'} remaining.
                      </FieldDescription>
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <FieldSeparator>Classification</FieldSeparator>

            <FieldGroup data-slot="field-group" className="grid @md/field-group:grid-cols-2">
              <form.Field name="status">
                {(field) => {
                  const isInvalid = field.state.meta.errors.length > 0;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(next: string | null) =>
                          next && field.handleChange(next as typeof field.state.value)
                        }
                      >
                        <SelectTrigger id={field.name} className="w-full" aria-invalid={isInvalid}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="ownerId">
                {(field) => {
                  const isInvalid = field.state.meta.errors.length > 0;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Owner</FieldLabel>
                      <OwnerCombobox
                        id={field.name}
                        value={field.state.value}
                        onChange={field.handleChange}
                        ariaInvalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </form.Field>
            </FieldGroup>

            <form.Field name="priority">
              {(field) => {
                const isInvalid = field.state.meta.errors.length > 0;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel>Priority</FieldLabel>
                    <RadioCardGroup
                      name={field.name}
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={PRIORITY_OPTIONS}
                      columns={2}
                      ariaInvalid={isInvalid}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>

            <FieldSeparator>Schedule</FieldSeparator>

            <FieldGroup data-slot="field-group" className="grid @md/field-group:grid-cols-2">
              <form.Field name="startDate">
                {(field) => {
                  const isInvalid = field.state.meta.errors.length > 0;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Start date</FieldLabel>
                      <DateField
                        id={field.name}
                        value={field.state.value}
                        onChange={field.handleChange}
                        ariaInvalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="dueDate">
                {(field) => {
                  const isInvalid = field.state.meta.errors.length > 0;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Due date</FieldLabel>
                      <DateField
                        id={field.name}
                        value={field.state.value}
                        onChange={field.handleChange}
                        disabled={dueDateDisabled}
                        ariaInvalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </form.Field>
            </FieldGroup>

            <form.Field name="budget">
              {(field) => {
                const isInvalid = field.state.meta.errors.length > 0;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Budget</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon align="inline-start">$</InputGroupAddon>
                      <InputGroupInput
                        id={field.name}
                        name={field.name}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={100}
                        value={field.state.value}
                        onChange={(e) => {
                          const next = e.target.value;
                          field.handleChange(next === '' ? 0 : Number(next));
                        }}
                        onBlur={field.handleBlur}
                        aria-invalid={isInvalid}
                      />
                      <InputGroupAddon align="inline-end">USD</InputGroupAddon>
                    </InputGroup>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>

            <FieldSeparator>Access</FieldSeparator>

            <form.Field name="visibility">
              {(field) => {
                const isInvalid = field.state.meta.errors.length > 0;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel>Visibility</FieldLabel>
                    <RadioCardGroup
                      name={field.name}
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={VISIBILITY_OPTIONS}
                      columns={3}
                      ariaInvalid={isInvalid}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="notifyOn" mode="array">
              {(field) => {
                const isInvalid = field.state.meta.errors.length > 0;
                return (
                  <FieldSet data-invalid={isInvalid}>
                    <FieldLegend variant="label">Notify me when</FieldLegend>
                    <FieldDescription>
                      Pick the events that should send an email to the project owner.
                    </FieldDescription>
                    <FieldGroup data-slot="checkbox-group">
                      {PROJECT_NOTIFY_EVENTS.map((event) => {
                        const itemId = `${field.name}-${event}`;
                        const checked = field.state.value.includes(event);
                        return (
                          <Field key={event} orientation="horizontal">
                            <Checkbox
                              id={itemId}
                              name={field.name}
                              checked={checked}
                              aria-invalid={isInvalid}
                              onCheckedChange={(next) => {
                                if (next === true) {
                                  field.pushValue(event);
                                } else {
                                  const index = field.state.value.indexOf(event);
                                  if (index > -1) field.removeValue(index);
                                }
                              }}
                            />
                            <FieldContent>
                              <FieldLabel htmlFor={itemId} weight="normal">
                                {NOTIFY_LABELS[event].label}
                              </FieldLabel>
                              <FieldDescription>
                                {NOTIFY_LABELS[event].description}
                              </FieldDescription>
                            </FieldContent>
                          </Field>
                        );
                      })}
                    </FieldGroup>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </FieldSet>
                );
              }}
            </form.Field>

            <form.Field name="sendInvites">
              {(field) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>Send kickoff email</FieldLabel>
                    <FieldDescription>
                      Notify the owner and team the moment the project is created.
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={(next: boolean) => field.handleChange(next)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="acceptTerms">
              {(field) => {
                const isInvalid = field.state.meta.errors.length > 0;
                return (
                  <Field orientation="horizontal" data-invalid={isInvalid}>
                    <Checkbox
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(checked === true)}
                      aria-invalid={isInvalid}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={field.name} weight="normal" leading="relaxed">
                        I confirm I have authority to create this project.
                      </FieldLabel>
                      <FieldDescription>
                        By submitting you accept the{' '}
                        {/*
                          Rendered outside the FieldLabel to avoid a
                          <button>-inside-<label> interaction: clicking a
                          nested Button would otherwise also toggle the
                          checkbox via label-for-control pairing.
                          FieldDescription already styles <a> children.
                        */}
                        <a
                          href="/legal/project-terms"
                          onClick={(e) => e.preventDefault()}
                          className="font-medium"
                        >
                          project terms
                        </a>
                        .
                      </FieldDescription>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </FieldContent>
                  </Field>
                );
              }}
            </form.Field>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter gap="sm" className="flex flex-col-reverse @sm/main:flex-row @sm/main:justify-end">
        <form.Subscribe
          selector={(state) => ({
            isSubmitting: state.isSubmitting,
            isDirty: state.isDirty,
          })}
        >
          {({ isSubmitting, isDirty }) => (
            <>
              {isDirty && (
                <ConfirmResetButton
                  onConfirm={handleReset}
                  disabled={isSubmitting}
                  className="w-full @sm/main:w-auto"
                />
              )}
              <Button
                type="submit"
                form={FORM_ID}
                disabled={isSubmitting}
                className="w-full @sm/main:w-auto"
              >
                {isSubmitting && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
                Create project
              </Button>
            </>
          )}
        </form.Subscribe>
      </CardFooter>
    </Card>
  );
}
