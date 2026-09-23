import { createFormHook } from '@tanstack/react-form';
import { fieldContext, formContext } from '@/components/form/form-context';
import {
  ComboboxField,
  PasswordField,
  RadioGroupField,
  SwitchField,
  TextField,
} from '@/components/form/form-fields';

/** `useForm` with the field components attached, used as `<form.AppField>{(field) => <field.TextField />}`. */
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, PasswordField, SwitchField, RadioGroupField, ComboboxField },
  formComponents: {},
});
