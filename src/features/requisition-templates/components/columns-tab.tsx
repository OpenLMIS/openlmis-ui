import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useStore } from '@tanstack/react-form';
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DataTableCard } from '@/components/data-table/data-table';
import { CardList } from '@/components/display/card-list';
import { SettingsList } from '@/components/form/settings-list';
import { Table, TableBody } from '@/components/ui/table';
import {
  ColumnCard,
  ColumnCardPreview,
  ColumnRow,
  ColumnRowPreview,
} from '@/features/requisition-templates/components/column-row';
import { TemplateColumnsHeader } from '@/features/requisition-templates/components/template-columns-header';
import type { TemplateEditorForm } from '@/features/requisition-templates/components/template-editor';
import { movableRuns, moveColumn } from '@/features/requisition-templates/lib/column-order';
import { columnOrder, setStockFlag } from '@/features/requisition-templates/lib/template-draft';
import type { RequisitionTemplate } from '@/features/requisition-templates/lib/types';

export function ColumnsTab({
  form,
  saved,
  cards,
}: {
  form: TemplateEditorForm;
  saved: RequisitionTemplate;
  cards: boolean;
}) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const orderText = useStore(form.store, (state) => columnOrder(state.values).join('|'));
  const order = useMemo(() => orderText.split('|'), [orderText]);
  const rows = useMemo(
    () =>
      order
        .map((key) =>
          Object.values(saved.columnsMap).find((column) => column.columnDefinition.id === key),
        )
        .filter((column) => column !== undefined),
    [order, saved],
  );
  const orderRows = () =>
    columnOrder(form.state.values).map((id) => ({
      id,
      canChangeOrder: form.state.values.columnDefinitions[id].canChangeOrder,
      displayOrder: form.state.values.columns[id].displayOrder,
    }));
  const runs = movableRuns(orderRows()).map((run) => run.map((row) => row.id));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const collisionDetection: CollisionDetection = (args) => {
    const run = runs.find((run) => run.includes(String(args.active.id))) ?? [];
    const filtered = {
      ...args,
      droppableContainers: args.droppableContainers.filter((container) =>
        run.includes(String(container.id)),
      ),
    };
    const hits = args.pointerCoordinates ? pointerWithin(args) : [];
    if (hits.length) return hits;
    return closestCenter(filtered);
  };
  const activeRow = rows.find((row) => row.columnDefinition.id === activeId);
  const label = (id: string | number) => form.state.values.columns[String(id)]?.label ?? '';
  const position = (id: string | number) => order.indexOf(String(id)) + 1;
  const items = (Item: typeof ColumnRow) =>
    rows.map((row) => {
      const key = row.columnDefinition.id;
      if (!row.columnDefinition.canChangeOrder) return <Item key={key} form={form} column={row} />;
      const run = runs.find((run) => run[0] === key);
      return run ? (
        <SortableContext key={key} items={run} strategy={verticalListSortingStrategy}>
          {run.map((id) => (
            <Item
              key={id}
              form={form}
              column={rows.find((row) => row.columnDefinition.id === id) ?? row}
            />
          ))}
        </SortableContext>
      ) : (
        <Fragment key={key} />
      );
    });
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-2xl">
        <SettingsList>
          <form.AppField
            name="populateStockOnHandFromStockCards"
            listeners={{
              onChange: ({ value }) => {
                const next = setStockFlag(form.state.values, value);
                form.setFieldValue('columns', next.columns);
              },
            }}
          >
            {(field) => (
              <field.SwitchField
                layout="row"
                label={t('requisition-templates.configure.stock')}
                description={t('requisition-templates.configure.stock-help')}
              />
            )}
          </form.AppField>
        </SettingsList>
      </div>
      <DndContext
        sensors={sensors}
        modifiers={[restrictToVerticalAxis]}
        collisionDetection={collisionDetection}
        accessibility={{
          screenReaderInstructions: {
            draggable: t('requisition-templates.configure.drag-instructions'),
          },
          announcements: {
            onDragStart: ({ active }) =>
              t('requisition-templates.configure.drag-start', { label: label(active.id) }),
            onDragOver: ({ active, over }) =>
              over
                ? t('requisition-templates.configure.drag-over', {
                    label: label(active.id),
                    position: position(over.id),
                    count: order.length,
                  })
                : undefined,
            onDragEnd: ({ active }) =>
              t('requisition-templates.configure.drag-end', { label: label(active.id) }),
            onDragCancel: ({ active }) =>
              t('requisition-templates.configure.drag-cancel', { label: label(active.id) }),
          },
        }}
        onDragStart={({ active }) => setActiveId(String(active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={({ active, over }) => {
          setActiveId(null);
          if (active.id === over?.id) return;
          const currentRows = orderRows();
          const moved = over ? moveColumn(currentRows, String(active.id), String(over.id)) : null;
          if (!moved) {
            toast.error(t('requisition-templates.configure.drop-refused-title'), {
              description: t('requisition-templates.configure.drop-refused'),
            });
            return;
          }
          form.setFieldValue('columns', (columns) =>
            Object.fromEntries(
              Object.entries(columns).map(([key, column]) => [
                key,
                { ...column, displayOrder: moved[key] },
              ]),
            ),
          );
        }}
      >
        {cards ? (
          <CardList>{items(ColumnCard)}</CardList>
        ) : (
          <DataTableCard>
            <Table
              layout="fixed"
              width="measured"
              style={{ '--table-width': '70rem' } as React.CSSProperties}
            >
              <TemplateColumnsHeader />
              <TableBody>{items(ColumnRow)}</TableBody>
            </Table>
          </DataTableCard>
        )}
        <DragOverlay>
          {activeRow &&
            (cards ? (
              <ColumnCardPreview form={form} column={activeRow} />
            ) : (
              <ColumnRowPreview form={form} column={activeRow} />
            ))}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
