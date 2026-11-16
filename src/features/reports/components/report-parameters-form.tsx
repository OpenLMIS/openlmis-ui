import { revalidateLogic } from '@tanstack/react-form';
import { FileDownIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InvalidSubmitDialog } from '@/components/display/invalid-submit-dialog';
import { useAppForm } from '@/components/form/form';
import { FieldLabelText } from '@/components/form/form-fields';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldGroup } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { apiBase } from '@/features/reports/api/api';
import { useReportGeneration } from '@/features/reports/components/report-delivery';
import { ReportParameterField } from '@/features/reports/components/report-parameter-field';
import {
  classifyParameters,
  emptyReportValues,
  REPORT_FORMATS,
  reportParametersSchema,
  serializeReportParams,
} from '@/features/reports/lib/report-parameters';
import type { ReportFormat, ReportTemplate } from '@/features/reports/lib/types';

type Props = { template: ReportTemplate; module: string; userId: string };

const FORMAT_OPTIONS = REPORT_FORMATS.map((format) => ({
  value: format,
  label: format.toUpperCase(),
}));

export function ReportParametersForm({ template, module, userId }: Props) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const generateRef = useRef<HTMLButtonElement>(null);
  const [invalidOpen, setInvalidOpen] = useState(false);
  const fields = useMemo(
    () => classifyParameters(template.templateParameters, apiBase()),
    [template.templateParameters],
  );
  const schema = useMemo(() => reportParametersSchema(fields), [fields]);
  const generation = useReportGeneration({
    userId,
    module,
    reportId: template.id,
    reportName: template.name,
  });
  const form = useAppForm({
    defaultValues: emptyReportValues(fields),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => {
      const values = { ...value };
      generation.generate(values.format as ReportFormat, (language) =>
        serializeReportParams(fields, values, language),
      );
    },
    onSubmitInvalid: () => setInvalidOpen(true),
  });

  return (
    <form
      ref={formRef}
      noValidate
      aria-busy={generation.isPending}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        {fields.length === 0 && (
          <p className="text-muted-foreground text-sm">{t('reports.generate.no-options')}</p>
        )}
        {fields.map((field) => (
          <ReportParameterField
            key={field.key}
            form={form}
            field={field}
            fields={fields}
            userId={userId}
          />
        ))}
        {fields.length > 0 && <Separator />}
        <div className="flex flex-col gap-2">
          <form.AppField name="format">
            {(field) => (
              <field.RadioGroupField
                label={<FieldLabelText label={t('reports.generate.format')} required />}
                options={FORMAT_OPTIONS}
                variant="tile"
              />
            )}
          </form.AppField>
          <FieldDescription>{t('reports.generate.format-description')}</FieldDescription>
        </div>
        <div className="flex flex-col gap-3">
          {generation.isPending && (
            <p className="text-muted-foreground text-sm">{t('reports.generate.long-running')}</p>
          )}
          {generation.disabledReason && (
            <p className="text-muted-foreground text-sm">{generation.disabledReason}</p>
          )}
          <div className="flex flex-col-reverse gap-2 @xl/main:flex-row @xl/main:justify-end">
            {generation.isPending && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  generation.cancel();
                  generateRef.current?.focus();
                }}
              >
                {t('reports.generate.cancel')}
              </Button>
            )}
            <Button
              ref={generateRef}
              type="submit"
              size="lg"
              focusableWhenDisabled
              disabled={generation.isPending || generation.offline}
            >
              {generation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <FileDownIcon data-icon="inline-start" />
              )}
              {generation.isPending
                ? t('reports.generate.generating')
                : t('reports.generate.submit')}
            </Button>
          </div>
        </div>
      </FieldGroup>
      <InvalidSubmitDialog
        open={invalidOpen}
        onOpenChange={setInvalidOpen}
        title={t('reports.generate.invalid-title')}
        description={t('reports.generate.invalid-description')}
        closeLabel={t('dialog.close')}
        finalFocus={false}
        onOpenChangeComplete={(open) => {
          if (!open) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        }}
      />
    </form>
  );
}
