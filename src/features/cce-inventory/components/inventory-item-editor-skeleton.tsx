import type { ParseKeys } from 'i18next';
import { RefrigeratorIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FieldSkeleton } from '@/components/display/dialog-parts';
import { Button } from '@/components/ui/button';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { Section } from '@/features/cce-inventory/components/inventory-item-sections';

export function EditorHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <RefrigeratorIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('cce-inventory.form.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('cce-inventory.form.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

type SkeletonField = {
  label: ParseKeys;
  required: boolean;
  description?: ParseKeys;
  wide?: boolean;
};

const SKELETON_SECTIONS: readonly { legend: ParseKeys; fields: readonly SkeletonField[] }[] = [
  {
    legend: 'cce-inventory.form.equipment',
    fields: [
      { label: 'facility-program.mode', required: false, wide: true },
      { label: 'facility-program.program', required: true },
      { label: 'facility-program.facility', required: true },
      { label: 'cce-inventory.form.equipment-type', required: true },
      { label: 'cce-inventory.form.make-model', required: true },
    ],
  },
  {
    legend: 'cce-inventory.form.identification',
    fields: [
      { label: 'cce-inventory.form.serial-number', required: true },
      {
        label: 'cce-inventory.form.reference-name',
        required: true,
        description: 'cce-inventory.form.reference-name-description',
      },
    ],
  },
  {
    legend: 'cce-inventory.form.history',
    fields: [
      { label: 'cce-inventory.form.utilization', required: true },
      { label: 'cce-inventory.form.year-of-installation', required: true },
      {
        label: 'cce-inventory.form.source',
        required: false,
        description: 'cce-inventory.form.source-description',
      },
      { label: 'cce-inventory.form.year-of-warranty-expiry', required: false },
    ],
  },
  {
    legend: 'cce-inventory.form.installation',
    fields: [
      { label: 'cce-inventory.form.voltage-stabilizer', required: true },
      { label: 'cce-inventory.form.voltage-regulator', required: true },
      { label: 'cce-inventory.form.backup-generator', required: true },
      { label: 'cce-inventory.form.manual-temperature-gauge', required: true },
      { label: 'cce-inventory.form.remote-temperature-monitor', required: true },
    ],
  },
  {
    legend: 'cce-inventory.form.status',
    fields: [{ label: 'cce-inventory.form.functional-status', required: true }],
  },
];

export function FormSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-8">
      {SKELETON_SECTIONS.map(({ legend, fields }) => (
        <Section key={legend} legend={t(legend)}>
          {fields.map(({ label, required, description, wide }) => (
            <div className={wide ? '@3xl/main:col-span-2' : undefined} key={label}>
              <FieldSkeleton
                description={description && t(description)}
                label={t(label)}
                required={required}
              />
            </div>
          ))}
        </Section>
      ))}
      <FieldSkeleton control="textarea" label={t('cce-inventory.form.additional-notes')} />
    </div>
  );
}

export function InventoryItemEditorSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <Workspace width="narrow">
        <EditorHeader />
        <WorkspaceContent>
          <FormSkeleton />
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled size="lg" variant="outline">
          {t('cce-inventory.form.cancel')}
        </Button>
        <Button disabled size="lg">
          {t('cce-inventory.form.save')}
        </Button>
      </WorkspaceFooter>
    </>
  );
}
