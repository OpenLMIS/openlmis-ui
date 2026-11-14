import { useStore } from '@tanstack/react-form';
import { Fragment, type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
import {
  CardBand,
  CardControlRow,
  CardList,
  CardListItem,
  CardListSkeleton,
  CardRows,
} from '@/components/display/card-list';
import { SettingsItem } from '@/components/form/settings-list';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PodForm } from '@/features/orders/lib/pod-form';
import type { PodGridLine, PodLineGroup } from '@/features/orders/lib/pod-lines';
import {
  podAutoClear,
  returnedQuantity,
  validatePodLine,
} from '@/features/orders/lib/pod-validation';
import { useCardLayout } from '@/hooks/use-card-view';
import { orEmpty, tableValue } from '@/lib/empty-value';
import { vvmStages } from '@/lib/vvm';

const columns = [
  'product-name',
  'product-unit',
  'quantity-ordered',
  'quantity-shipped',
  'lot-code',
  'accepted',
  'vvm',
  'returned',
  'reason',
  'notes',
] as const;
export function PodGridSkeleton() {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const visible = columns.filter((key) => key !== 'vvm');
  return (
    <div ref={measure}>
      {cards ? (
        <CardListSkeleton count={2} rows={4} pagination={false} />
      ) : (
        <DataTableCard>
          <Table density="compact">
            <TableHeader surface="muted">
              <TableRow>
                {visible.map((key) => (
                  <TableHead key={key}>
                    <DataTableHeaderLabel>{t(`orders.pod.${key}`)}</DataTableHeaderLabel>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[0, 1, 2].map((row) => (
                <TableRow key={row}>
                  {visible.map((key) => (
                    <TableCell key={key}>
                      <div className="h-4 w-20">
                        <Skeleton fill />
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      )}
    </div>
  );
}
export function PodGrid({
  form,
  groups,
  lots,
  reasons,
  editable,
  disabled,
  attempted,
}: {
  form: PodForm;
  groups: PodLineGroup[];
  lots: { id: string; lotCode: string }[];
  reasons: { id: string; name: string }[];
  editable: boolean;
  disabled: boolean;
  attempted: boolean;
}) {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const useVvm = groups.some((group) =>
    group.products.some((product) => product.lines.some((line) => line.useVvm)),
  );
  const visible = columns.filter((key) => key !== 'vvm' || useVvm);
  const groupName = (group: PodLineGroup) =>
    group.orderLine?.orderable.fullProductName ?? t('orders.pod.other-products');
  const firstGroup = new Map<string, PodLineGroup>();
  for (const group of groups)
    for (const product of group.products)
      for (const line of product.lines)
        if (!firstGroup.has(line.id)) firstGroup.set(line.id, group);
  const rows = (group: PodLineGroup) =>
    group.products.flatMap((product) =>
      product.lines.map((line) => (
        <PodRow
          key={line.id}
          line={line}
          showName={!product.collapsed}
          name={product.product.fullProductName ?? product.product.id}
          unit={product.product.dispensable?.displayUnit}
          form={form}
          cards={cards}
          useVvm={useVvm}
          lot={lots.find((lot) => lot.id === line.lot?.id)?.lotCode ?? t('orders.pod.no-lot')}
          reasons={reasons}
          editable={editable && line.quantityShipped !== null && firstGroup.get(line.id) === group}
          disabled={disabled}
          attempted={attempted}
        />
      )),
    );
  return (
    <div ref={measure}>
      {cards ? (
        <CardList>
          {groups.map((group, index) => (
            <CardListItem key={group.orderLine?.orderable.id ?? index}>
              <CardBand>
                <bdi>{groupName(group)}</bdi>
              </CardBand>
              <CardRows>
                <SettingsItem label={t('orders.pod.product-unit')}>
                  <bdi>{orEmpty(group.orderLine?.orderable.dispensable?.displayUnit)}</bdi>
                </SettingsItem>
                <SettingsItem label={t('orders.pod.quantity-ordered')}>
                  {orEmpty(group.orderLine?.orderedQuantity)}
                </SettingsItem>
              </CardRows>
              {rows(group)}
            </CardListItem>
          ))}
        </CardList>
      ) : (
        <DataTableCard>
          <Table scroll="both">
            <TableHeader surface="muted">
              <TableRow>
                {visible.map((key) => (
                  <TableHead key={key}>
                    <DataTableHeaderLabel>{t(`orders.pod.${key}`)}</DataTableHeaderLabel>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group, index) => (
                <Fragment key={group.orderLine?.orderable.id ?? index}>
                  <TableRow tone="skipped">
                    <TableCell rowHeader>
                      <bdi>{groupName(group)}</bdi>
                    </TableCell>
                    <TableCell>
                      <bdi>{group.orderLine?.orderable.dispensable?.displayUnit}</bdi>
                    </TableCell>
                    <TableCell>{group.orderLine?.orderedQuantity}</TableCell>
                    <TableCell colSpan={visible.length - 3} />
                  </TableRow>
                  {rows(group)}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      )}
    </div>
  );
}
function PodRow({
  form,
  line,
  name,
  lot,
  cards,
  reasons,
  editable,
  disabled,
  attempted,
  useVvm,
  showName,
  unit,
}: {
  unit?: string | null;
  showName: boolean;
  form: PodForm;
  line: PodGridLine;
  name: string;
  lot: string;
  cards: boolean;
  reasons: { id: string; name: string }[];
  editable: boolean;
  disabled: boolean;
  attempted: boolean;
  useVvm: boolean;
}) {
  const { t, i18n } = useTranslation();
  const values = useStore(form.store, (state) => state.values.lines[line.id]);
  const revealed = useRef(false);
  const path = `lines.${line.id}` as const;
  const empty = <T,>(value: T | null | undefined) => (cards ? orEmpty(value) : tableValue(value));
  const number = (value: number | null) =>
    empty(value === null ? null : value.toLocaleString(i18n.language));
  const control = (key: 'accepted' | 'vvm' | 'reason' | 'notes') => {
    if (!editable)
      return empty(
        key === 'accepted'
          ? values.accepted
          : key === 'reason'
            ? (reasons.find((reason) => reason.id === values.reason)?.name ?? values.reason)
            : key === 'vvm'
              ? (vvmStages(t).find((stage) => stage.value === values.vvm)?.label ?? values.vvm)
              : values.notes,
      );
    return (
      <form.AppField
        name={`${path}.${key}`}
        validators={{
          onChange: ({ value }) =>
            revealed.current || attempted
              ? validatePodLine({ ...form.getFieldValue(path), [key]: value }, line, 'confirm')[key]
              : undefined,
        }}
        listeners={{
          onBlur: ({ fieldApi }) => {
            revealed.current = true;
            void fieldApi.validate('change');
          },
          onChange: ({ value }) => {
            if (key !== 'accepted') return;
            const clear = podAutoClear(value, line.quantityShipped);
            const current = form.state.values.lines[line.id];
            if ((clear.reason && current.reason) || (clear.vvm && current.vvm))
              form.setFieldValue('lines', (previous) => ({
                ...previous,
                [line.id]: {
                  ...previous[line.id],
                  reason: clear.reason ? '' : previous[line.id].reason,
                  vvm: clear.vvm ? '' : previous[line.id].vvm,
                },
              }));
            void form.validateField(`${path}.reason`, 'change');
            void form.validateField(`${path}.vvm`, 'change');
          },
        }}
      >
        {(field) =>
          key === 'accepted' ? (
            <field.NumberField
              label={t('orders.pod.accepted-for', { product: name, lot })}
              layout="inline"
              hideErrors
              required
              disabled={disabled}
              controlSize={cards ? undefined : 'sm'}
            />
          ) : key === 'reason' || key === 'vvm' ? (
            <field.SelectField
              label={t(`orders.pod.${key}-for`, { product: name, lot })}
              layout="inline"
              hideErrors
              disabled={disabled}
              size={cards ? undefined : 'sm'}
              items={
                key === 'reason'
                  ? [
                      { value: '', label: t('orders.pod.select-reason') },
                      ...reasons.map((reason) => ({ value: reason.id, label: reason.name })),
                    ]
                  : [{ value: '', label: t('orders.pod.select-status') }, ...vvmStages(t)]
              }
            />
          ) : (
            <field.TextareaField
              label={t('orders.pod.notes-for', { product: name, lot })}
              layout="inline"
              hideErrors
              disabled={disabled}
            />
          )
        }
      </form.AppField>
    );
  };
  const details: [(typeof columns)[number], ReactNode][] = [
    ['quantity-shipped', number(line.quantityShipped)],
    ...(cards ? [] : [['lot-code' as const, lot] as [(typeof columns)[number], ReactNode]]),
    ['accepted', control('accepted')],
    ...(useVvm
      ? [
          ['vvm' as const, line.useVvm ? control('vvm') : empty(null)] as [
            (typeof columns)[number],
            ReactNode,
          ],
        ]
      : []),
    ['returned', number(returnedQuantity(line.quantityShipped ?? 0, values.accepted))],
    ['reason', control('reason')],
    ['notes', control('notes')],
  ];
  return cards ? (
    <>
      <CardBand>
        <bdi>{showName ? name : lot}</bdi>
        {showName && <bdi>{lot}</bdi>}
      </CardBand>
      <CardRows>
        {showName && (
          <SettingsItem label={t('orders.pod.product-unit')}>{orEmpty(unit)}</SettingsItem>
        )}
        {details.map(([key, value]) => (
          <CardControlRow key={key} label={t(`orders.pod.${key}`)}>
            {value}
          </CardControlRow>
        ))}
        {line.quantityShipped === null && <p>{t('orders.pod.no-shipped-quantity')}</p>}
      </CardRows>
    </>
  ) : (
    <TableRow>
      <TableCell rowHeader>
        {showName ? <bdi>{name}</bdi> : <span className="sr-only">{name}</span>}
      </TableCell>
      <TableCell>{showName ? <bdi>{unit}</bdi> : null}</TableCell>
      <TableCell />
      {details.map(([key, value]) => (
        <TableCell key={key}>
          <div className="min-w-28">{value}</div>
        </TableCell>
      ))}
    </TableRow>
  );
}
