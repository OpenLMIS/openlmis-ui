import { FileSlidersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Block } from '@/components/app-shell/skeleton-block';
import { DataTableCard } from '@/components/data-table/data-table';
import { CardControlRow, CardListSkeleton, SkeletonBar } from '@/components/display/card-list';
import { FieldSkeleton, SwitchRowSkeleton } from '@/components/display/dialog-parts';
import { SettingsList } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { TemplateColumnsHeader } from '@/features/requisition-templates/components/template-columns-header';
import type { TemplateTab } from '@/features/requisition-templates/components/template-editor';
import { useCardLayout } from '@/hooks/use-card-view';

const SKELETON_ROWS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6', 'row-7', 'row-8'];

export function TemplateEditorSkeleton({
  tab = 'columns',
  title,
}: {
  tab?: TemplateTab;
  title?: string;
}) {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <>
      <Workspace width="large">
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <FileSlidersIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>{title ?? <Block className="h-8 w-72" />}</WorkspaceTitle>
            <WorkspaceDescription>
              {t('requisition-templates.configure.description')}
            </WorkspaceDescription>
          </WorkspaceHeading>
        </WorkspaceHeader>
        <WorkspaceContent>
          <div ref={measure}>
            <Tabs value={tab} spacing="page">
              <TabsList aria-label={t('requisition-templates.configure.tabs-label')} size="lg">
                <TabsTrigger disabled value="columns">
                  {t('requisition-templates.configure.columns')}
                </TabsTrigger>
                <TabsTrigger disabled value="settings">
                  {t('requisition-templates.configure.settings')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="columns">
                <div className="flex flex-col gap-4">
                  <div className="max-w-2xl">
                    <SettingsList>
                      <div>
                        <SwitchRowSkeleton label={t('requisition-templates.configure.stock')} />
                        <p className="text-muted-foreground text-sm">
                          {t('requisition-templates.configure.stock-help')}
                        </p>
                      </div>
                    </SettingsList>
                  </div>
                  {cards ? (
                    <CardListSkeleton
                      band={
                        <>
                          <div className="flex items-center gap-2">
                            <Block className="size-7" />
                            <Block className="size-6" shape="circle" />
                            <SkeletonBar width="w-32" />
                          </div>
                          <div className="flex items-center gap-2 font-normal">
                            {t('requisition-templates.configure.display')}
                            <Block className="size-4" />
                          </div>
                        </>
                      }
                      count={SKELETON_ROWS.length}
                      pagination={false}
                      row={
                        <CardControlRow label={<SkeletonBar width="w-20" />}>
                          <Block className="h-8 w-full" />
                        </CardControlRow>
                      }
                      rows={3}
                    />
                  ) : (
                    <DataTableCard>
                      <Table
                        layout="fixed"
                        width="measured"
                        style={{ '--table-width': '70rem' } as React.CSSProperties}
                      >
                        <TemplateColumnsHeader />
                        <TableBody>
                          {SKELETON_ROWS.map((key) => (
                            <TableRow key={key}>
                              <TableCell>
                                <Block className="size-4" />
                              </TableCell>
                              <TableCell>
                                <Block className="size-4" />
                              </TableCell>
                              <TableCell>
                                <Block className="size-6" />
                              </TableCell>
                              <TableCell>
                                <Block className="h-7 w-full" />
                              </TableCell>
                              <TableCell>
                                <Block className="h-7 w-full" />
                              </TableCell>
                              <TableCell>
                                <Block className="h-7 w-full" />
                              </TableCell>
                              <TableCell>
                                <Block className="h-7 w-full" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </DataTableCard>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="settings">
                <div className="max-w-2xl">
                  <FieldGroup>
                    <FieldSkeleton label={t('requisition-templates.configure.name')} required />
                    <SettingsList>
                      {(['rejection', 'report-only', 'patients'] as const).map((key) => (
                        <SwitchRowSkeleton
                          key={key}
                          label={t(`requisition-templates.configure.${key}`)}
                        />
                      ))}
                    </SettingsList>
                    <FieldSkeleton label={t('requisition-templates.configure.facility-type')} />
                  </FieldGroup>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="large">
        <Button disabled size="lg" variant="outline">
          {t('requisition-templates.configure.cancel')}
        </Button>
        <Button disabled size="lg">
          {t('requisition-templates.configure.save')}
        </Button>
      </WorkspaceFooter>
    </>
  );
}
