import { useStore } from '@tanstack/react-form';
import { Fragment, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
import {
  CardBand,
  CardControlRow,
  CardList,
  CardListItem,
  CardRows,
} from '@/components/display/card-list';
import { SettingsItem } from '@/components/form/settings-list';
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
import { orEmpty } from '@/lib/empty-value';
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
          editable={editable && line.quantityShipped !== null}
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
              <CardBand>{groupName(group)}</CardBand>
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
            <TableHeader>
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
                    <TableCell rowHeader>{groupName(group)}</TableCell>
                    <TableCell>
                      <bdi>{orEmpty(group.orderLine?.orderable.dispensable?.displayUnit)}</bdi>
                    </TableCell>
                    <TableCell>{orEmpty(group.orderLine?.orderedQuantity)}</TableCell>
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
  const [revealed, setRevealed] = useState(false);
  const path = `lines.${line.id}` as const;
  const number = (value: number | null) =>
    value === null ? orEmpty(null) : value.toLocaleString(i18n.language);
  const control = (key: 'accepted' | 'vvm' | 'reason' | 'notes') => {
    if (!editable)
      return orEmpty(
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
          onChangeListenTo: [`${path}.accepted`],
          onChange: ({ value }) =>
            revealed || attempted
              ? validatePodLine({ ...form.getFieldValue(path), [key]: value }, line, 'confirm')[key]
              : undefined,
          onBlur: () => validatePodLine(form.getFieldValue(path), line, 'confirm')[key],
        }}
        listeners={{
          onBlur: () => setRevealed(true),
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
            />
          ) : key === 'reason' || key === 'vvm' ? (
            <field.SelectField
              label={t(`orders.pod.${key}-for`, { product: name, lot })}
              layout="inline"
              hideErrors
              disabled={disabled}
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
    ['lot-code', lot],
    ['accepted', control('accepted')],
    ...(useVvm
      ? [
          ['vvm' as const, line.useVvm ? control('vvm') : orEmpty(null)] as [
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
        <span>{showName ? name : lot}</span>
        {showName && <span>{lot}</span>}
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
      <TableCell rowHeader>{showName ? name : <span className="sr-only">{name}</span>}</TableCell>
      <TableCell>{showName ? <bdi>{orEmpty(unit)}</bdi> : null}</TableCell>
      <TableCell />
      {details.map(([key, value]) => (
        <TableCell key={key}>
          <div className="min-w-28">{value}</div>
        </TableCell>
      ))}
    </TableRow>
  );
}
