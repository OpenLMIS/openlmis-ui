import { createFormHook } from '@tanstack/react-form';
import { fieldContext, formContext } from '@/components/form/form-context';
import { CheckboxField, ComboboxField, TextField } from '@/components/form/form-fields';

/** `useForm` with the field components attached, used as `<form.AppField>{(field) => <field.TextField />}`. */
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, CheckboxField, ComboboxField },
  formComponents: {},
});
