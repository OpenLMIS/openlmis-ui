import { createFormHook } from '@tanstack/react-form';
import { fieldContext, formContext } from '@/components/form/form-context';
import {
  ComboboxField,
  ImageField,
  MultiComboboxField,
  PasswordField,
  RadioGroupField,
  SelectField,
  SwitchField,
  TextareaField,
  TextField,
} from '@/components/form/form-fields';

/** `useForm` with the field components attached, used as `<form.AppField>{(field) => <field.TextField />}`. */
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    PasswordField,
    SwitchField,
    RadioGroupField,
    ComboboxField,
    MultiComboboxField,
    SelectField,
    ImageField,
  },
  formComponents: {},
});
