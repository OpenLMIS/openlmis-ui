import { useSuspenseQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { DataTableHeaderLabel } from '@/components/data-table/data-table';
import {
  CardBand,
  CardList,
  CardListItem,
  CardListSkeleton,
  CardRows,
} from '@/components/display/card-list';
import { DialogLoadError, DialogNotFound, SkeletonLine } from '@/components/display/dialog-parts';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  geographicZoneChildrenOptions,
  geographicZoneDetailOptions,
} from '@/features/geographic-zones/api/queries';
import { geographicZonePolicy } from '@/features/geographic-zones/lib/zone-form';
import { geographicLevelsOptions } from '@/features/reference-data/api/queries';
import type { GeographicZone } from '@/features/reference-data/lib/types';
import { useDialogCardLayout } from '@/hooks/use-card-view';
import { useOpening } from '@/hooks/use-opening';
import { EMPTY_VALUE, orEmpty } from '@/lib/empty-value';
import { isNotFound } from '@/lib/http';

type GeographicZonePopulationDialogProps = { target: string | undefined; onClose: () => void };

export function GeographicZonePopulationDialog({
  target,
  onClose,
}: GeographicZonePopulationDialogProps) {
  const { shown, dialogProps } = useDialogTarget(target, onClose);
  return (
    <FormDialog {...dialogProps()} size="table">
      {shown && <PopulationDialogContent key={shown} zoneId={shown} />}
    </FormDialog>
  );
}

function PopulationDialogContent({ zoneId }: { zoneId: string }) {
  const { t } = useTranslation();
  const opening = useOpening();
  const { measure, cards } = useDialogCardLayout('table');
  const title = t('geographic-zones.visualize');
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" ref={measure}>
      <QueryBoundary
        errorComponent={({ error, reset }) =>
          isNotFound(error) ? (
            <DialogNotFound description={t('geographic-zones.not-found')} title={title} />
          ) : (
            <DialogLoadError
              error={error}
              errorTitle={t('geographic-zones.population-error-title')}
              onRetry={reset}
              title={title}
            />
          )
        }
        pendingFallback={<PopulationSkeleton cards={cards} />}
        resetKey={zoneId}
      >
        <PopulationContent cards={cards} opening={opening} zoneId={zoneId} />
      </QueryBoundary>
    </div>
  );
}

function PopulationContent({
  zoneId,
  opening,
  cards,
}: {
  zoneId: string;
  opening: number;
  cards: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [{ data: zone }, { data: levels }, { data: children }] = useSuspenseQueries({
    queries: [
      geographicZoneDetailOptions(zoneId, opening),
      geographicLevelsOptions(),
      geographicZoneChildrenOptions(zoneId, opening),
    ],
  });
  const policy = geographicZonePolicy(zone, levels, false);
  if (!policy?.visualizable)
    return (
      <DialogNotFound
        description={t(
          policy
            ? 'geographic-zones.population-unavailable'
            : 'geographic-zones.configuration-description',
        )}
        title={t('geographic-zones.visualize')}
      />
    );
  const number = new Intl.NumberFormat(i18n.language);
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>
          {t('geographic-zones.population-title', { zone: zone.name })}
        </FormDialogTitle>
        <FormDialogDescription>{t('geographic-zones.population-summary')}</FormDialogDescription>
      </FormDialogHeader>
      <div className="shrink-0">
        <SettingsList>
          <SettingsItem label={t('geographic-zones.name')}>
            <span dir="auto">{orEmpty(zone.name)}</span>
          </SettingsItem>
          <SettingsItem label={t('geographic-zones.level')}>
            <span dir="auto">{orEmpty(zone.level.name)}</span>
          </SettingsItem>
          <SettingsItem label={t('geographic-zones.total-population')}>
            {zone.catchmentPopulation == null
              ? orEmpty(null)
              : number.format(zone.catchmentPopulation)}
          </SettingsItem>
        </SettingsList>
      </div>
      {cards ? (
        <FormDialogBody>
          <PopulationCards zones={children} number={number} />
        </FormDialogBody>
      ) : (
        <FormDialogBody layout="table">
          <PopulationTable zones={children} number={number} />
        </FormDialogBody>
      )}
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}

const POPULATION_COLUMNS = ['name', 'level', 'population'] as const;

function PopulationTable({
  zones,
  number,
}: {
  zones: GeographicZone[];
  number: Intl.NumberFormat;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-0 flex-auto grid-rows-1 overflow-hidden rounded-lg border">
      <Table density="compact" scroll="both">
        <TableHeader surface="muted">
          <TableRow>
            {POPULATION_COLUMNS.map((column) => (
              <TableHead key={column}>
                <DataTableHeaderLabel>{t(`geographic-zones.${column}`)}</DataTableHeaderLabel>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {zones.length ? (
            zones.map((zone) => (
              <TableRow key={zone.id}>
                <TableCell>
                  <span className="whitespace-normal" dir="auto">
                    {zone.name}
                  </span>
                </TableCell>
                <TableCell>
                  <span dir="auto">{zone.level.name}</span>
                </TableCell>
                <TableCell>
                  <span className="tabular-nums">
                    {zone.catchmentPopulation == null
                      ? null
                      : number.format(zone.catchmentPopulation)}
                  </span>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3}>
                <div className="py-6 text-center text-muted-foreground whitespace-normal">
                  {t('geographic-zones.no-children')}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function PopulationCards({
  zones,
  number,
}: {
  zones: GeographicZone[];
  number: Intl.NumberFormat;
}) {
  const { t } = useTranslation();
  return (
    <CardList
      empty={
        zones.length === 0 && (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">
            {t('geographic-zones.no-children')}
          </div>
        )
      }
    >
      {zones.map((zone) => (
        <CardListItem key={zone.id} surface="flat">
          <CardBand>
            <div className="min-w-0 font-medium wrap-anywhere">
              <bdi>{zone.name}</bdi>
            </div>
          </CardBand>
          <CardRows>
            <SettingsItem label={t('geographic-zones.level')}>
              <bdi>{orEmpty(zone.level.name)}</bdi>
            </SettingsItem>
            <SettingsItem label={t('geographic-zones.population')}>
              <span className="tabular-nums">
                {zone.catchmentPopulation == null
                  ? EMPTY_VALUE
                  : number.format(zone.catchmentPopulation)}
              </span>
            </SettingsItem>
          </CardRows>
        </CardListItem>
      ))}
    </CardList>
  );
}

function PopulationSkeleton({ cards }: { cards: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{t('geographic-zones.visualize')}</FormDialogTitle>
        <SkeletonLine width="medium" />
      </FormDialogHeader>
      <div className="shrink-0">
        <SettingsList>
          {(['name', 'level', 'total-population'] as const).map((key) => (
            <SettingsItem key={key} label={t(`geographic-zones.${key}`)}>
              <SkeletonLine width="short" />
            </SettingsItem>
          ))}
        </SettingsList>
      </div>
      {cards ? (
        <FormDialogBody>
          <CardListSkeleton count={1} pagination={false} rows={2} surface="flat" />
        </FormDialogBody>
      ) : (
        <FormDialogBody layout="table">
          <div className="grid min-h-0 flex-auto grid-rows-1 overflow-hidden rounded-lg border">
            <Table density="compact" scroll="both">
              <TableHeader surface="muted">
                <TableRow>
                  {POPULATION_COLUMNS.map((column) => (
                    <TableHead key={column}>
                      <DataTableHeaderLabel>{t(`geographic-zones.${column}`)}</DataTableHeaderLabel>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[0, 1, 2, 3, 4].map((row) => (
                  <TableRow key={row}>
                    {POPULATION_COLUMNS.map((column) => (
                      <TableCell key={column}>
                        <div className="h-4 w-20">
                          <Skeleton fill />
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </FormDialogBody>
      )}
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}
