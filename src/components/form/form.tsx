import { createFormHook } from '@tanstack/react-form';
import { fieldContext, formContext } from '@/components/form/form-context';
import {
  ComboboxField,
  DateField,
  DecimalField,
  ImageField,
  MultiComboboxField,
  NumberField,
  PasswordField,
  RadioGroupField,
  SelectField,
  SwitchField,
  TextareaField,
  TextField,
} from '@/components/form/form-fields';

/** `useForm` with the field components attached, used as `<form.AppField>{(field) => <field.TextField />}`. */
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    NumberField,
    DecimalField,
    TextareaField,
    PasswordField,
    SwitchField,
    RadioGroupField,
    ComboboxField,
    MultiComboboxField,
    SelectField,
    ImageField,
    DateField,
  },
  formComponents: {},
});
