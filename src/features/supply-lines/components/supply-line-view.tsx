import { Link } from '@tanstack/react-router';
import { RouteIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import type { SupplyLinesSearch } from '@/features/supply-lines/lib/search';
import type { SupplyLine } from '@/features/supply-lines/lib/types';
import { orEmpty } from '@/lib/empty-value';

type SupplyLineViewProps = { line?: SupplyLine; listSearch: SupplyLinesSearch };

export function SupplyLineView({ line, listSearch }: SupplyLineViewProps) {
  const { t } = useTranslation();
  const values = [
    { label: t('supply-lines.program'), value: line?.program?.name, dir: 'auto' },
    { label: t('supply-lines.supervisory-node'), value: line?.supervisoryNode?.code, dir: 'ltr' },
    {
      label: t('supply-lines.supplying-facility'),
      value: line?.supplyingFacility?.name,
      dir: 'auto',
    },
    { label: t('supply-lines.view.description'), value: line?.description, dir: 'auto' },
  ];
  return (
    <>
      <Workspace width="narrow">
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <RouteIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>{t('supply-lines.view.title')}</WorkspaceTitle>
            <WorkspaceDescription>{t('supply-lines.view.page-description')}</WorkspaceDescription>
          </WorkspaceHeading>
        </WorkspaceHeader>
        <WorkspaceContent>
          <div aria-busy={!line}>
            <SettingsList>
              {values.map(({ label, value, dir }) => (
                <SettingsItem key={label} label={label}>
                  {line ? (
                    <span className="whitespace-pre-wrap" dir={dir}>
                      {orEmpty(value)}
                    </span>
                  ) : (
                    <span className="block h-5 w-32 max-w-full">
                      <Skeleton fill />
                    </span>
                  )}
                </SettingsItem>
              ))}
            </SettingsList>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button
          nativeButton={false}
          render={<Link to="/administration/supply-lines" search={listSearch} />}
          size="lg"
          variant="outline"
        >
          {t('supply-lines.view.cancel')}
        </Button>
      </WorkspaceFooter>
    </>
  );
}
