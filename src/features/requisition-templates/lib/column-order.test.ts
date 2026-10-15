import { expect, it } from 'vitest';
import {
  movableRuns,
  moveColumn,
  sortColumns,
} from '@/features/requisition-templates/lib/column-order';
import { liveTemplates } from '@/features/requisition-templates/lib/test-templates';

function rows() {
  const sample = Object.values(liveTemplates[0].columnsMap)[0];
  return [0, 1, 3, 4, 6, 7, 8].map((displayOrder) => ({
    id: `${displayOrder}`,
    canChangeOrder: ![1, 6].includes(displayOrder),
    ...sample,
    name: `${displayOrder}`,
    displayOrder,
    columnDefinition: {
      ...sample.columnDefinition,
      id: `${displayOrder}`,
      canChangeOrder: ![1, 6].includes(displayOrder),
    },
  }));
}
it('sorts ties in response order and splits movable runs at locks', () => {
  const columns = rows();
  columns[3].displayOrder = 3;
  expect(
    sortColumns(Object.fromEntries(columns.map((column) => [column.name, column]))).map(
      ({ name }) => name,
    ),
  ).toEqual(['0', '1', '3', '4', '6', '7', '8']);
  expect(movableRuns(columns).map((run) => run.map(({ name }) => name))).toEqual([
    ['0'],
    ['3', '4'],
    ['7', '8'],
  ]);
});
it('moves up and down using target values without renumbering gaps or mutating input', () => {
  const columns = rows();
  expect(moveColumn(columns, '4', '3')).toEqual({ 0: 0, 1: 1, 3: 4, 4: 3, 6: 6, 7: 7, 8: 8 });
  expect(moveColumn(columns, '3', '4')).toEqual({ 0: 0, 1: 1, 3: 4, 4: 3, 6: 6, 7: 7, 8: 8 });
  expect(columns.map(({ displayOrder }) => displayOrder)).toEqual([0, 1, 3, 4, 6, 7, 8]);
});
it('refuses locked rows, crossing locks, missing targets and the legacy zero lower bound', () => {
  for (const [from, to] of [
    ['1', '3'],
    ['3', '1'],
    ['3', '7'],
    ['7', '3'],
    ['missing', '3'],
    ['3', 'missing'],
  ])
    expect(moveColumn(rows(), from, to)).toBeNull();
  const columns = rows().map((column) => ({
    ...column,
    canChangeOrder: true,
  }));
  expect(moveColumn(columns, '3', '0')).toBeNull();
});
it('moves a column past tied neighbours, renumbering only as far as the tie reaches', () => {
  const columns = rows();
  columns[3].displayOrder = 3;
  expect(moveColumn(columns, '4', '3')).toEqual({ 0: 0, 1: 1, 3: 4, 4: 3, 6: 6, 7: 7, 8: 8 });
  const tied = [
    { id: 'R', canChangeOrder: false, displayOrder: 3 },
    { id: 'D', canChangeOrder: true, displayOrder: 7 },
    { id: 'TC', canChangeOrder: true, displayOrder: 7 },
    { id: 'X', canChangeOrder: true, displayOrder: 8 },
    { id: 'TD', canChangeOrder: true, displayOrder: 8 },
    { id: 'K', canChangeOrder: true, displayOrder: 17 },
  ];
  expect(moveColumn(tied, 'TC', 'D')).toEqual({ R: 3, TC: 7, D: 8, X: 9, TD: 10, K: 17 });
});

it('shifts every intervening row by one and leaves other runs unchanged', () => {
  const columns = rows();
  const extra = {
    ...columns[3],
    name: '5',
    id: '5',
    displayOrder: 5,
    columnDefinition: { ...columns[3].columnDefinition, id: '5' },
  };
  columns.splice(4, 0, extra);
  expect(moveColumn(columns, '3', '5')).toEqual({ 0: 0, 1: 1, 3: 5, 4: 3, 5: 4, 6: 6, 7: 7, 8: 8 });
  expect(moveColumn(columns, '5', '3')).toEqual({ 0: 0, 1: 1, 3: 4, 4: 5, 5: 3, 6: 6, 7: 7, 8: 8 });
});
