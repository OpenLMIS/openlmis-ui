import { expect, it } from 'vitest';
import { groupTemplatesByProgram } from '@/features/requisition-templates/lib/templates-list';

it('keeps empty programs and sorts sections and templates by name rather than API order', () => {
  const programs = [
    { id: 'z', code: 'Z', name: 'Zulu', active: true },
    { id: 'a', code: 'A', name: 'Alpha', active: true },
  ];
  const templates = [
    { id: '2', name: 'Zulu', program: { id: 'a' } },
    { id: '1', name: 'Alpha', program: { id: 'a' } },
  ];
  const groups = groupTemplatesByProgram(programs, templates);
  expect(groups.map(({ program }) => program.id)).toEqual(['a', 'z']);
  expect(groups.map(({ templates }) => templates.map(({ id }) => id))).toEqual([['1', '2'], []]);
  expect(programs[0].id).toBe('z');
  expect(templates[0].id).toBe('2');
});
