import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useAppForm } from '@/components/form/form';

const REFUSED = {
  'too-short': 'At least 3 characters',
  'too-long': 'At most 255 characters',
  duplicate: 'Already added',
} as const;

function Tags({ initial = [] as string[], onTags = (_: string[]) => {} }) {
  const form = useAppForm({
    defaultValues: { tags: initial },
    listeners: { onChange: ({ formApi }) => onTags(formApi.state.values.tags) },
  });
  return (
    <form.AppField name="tags">
      {(field) => (
        <field.TagsField
          label="Tags"
          refusedMessage={(reason) => REFUSED[reason]}
          removeLabel={(tag) => `Remove ${tag}`}
          suggestions={['adjustment', 'cancelAdjustment', 'cancelMovement', 'consumed']}
        />
      )}
    </form.AppField>
  );
}

const input = () => screen.getByRole('combobox', { name: 'Tags' });

describe('TagsField', () => {
  it('adds the typed text as a tag on Enter or a comma', async () => {
    const onTags = vi.fn();
    render(<Tags onTags={onTags} />);

    await userEvent.type(input(), 'damaged{Enter}');
    await userEvent.type(input(), ' in transit ,');

    expect(onTags).toHaveBeenLastCalledWith(['damaged', 'in transit']);
    expect(input()).toHaveValue('');
  });

  it('adds what was typed when the user leaves the box', async () => {
    const onTags = vi.fn();
    render(<Tags onTags={onTags} />);

    await userEvent.type(input(), 'damaged');
    await userEvent.tab();

    expect(onTags).toHaveBeenLastCalledWith(['damaged']);
  });

  it('adds a suggestion picked from the list', async () => {
    const onTags = vi.fn();
    render(<Tags onTags={onTags} />);

    await userEvent.type(input(), 'cancelM');
    await userEvent.click(await screen.findByRole('option', { name: 'cancelMovement' }));

    expect(onTags).toHaveBeenLastCalledWith(['cancelMovement']);
  });

  it('keeps refused text in the box and says why', async () => {
    const onTags = vi.fn();
    render(<Tags initial={['consumed']} onTags={onTags} />);

    await userEvent.type(input(), 'ab{Enter}');
    expect(screen.getByText('At least 3 characters')).toBeVisible();
    expect(input()).toHaveValue('ab');
    expect(input()).toHaveAccessibleDescription('At least 3 characters');

    await userEvent.clear(input());
    await userEvent.type(input(), 'CONSUMED,');
    expect(screen.getByText('Already added')).toBeVisible();
    expect(onTags).not.toHaveBeenCalled();
  });

  it('removes a tag with its x', async () => {
    const onTags = vi.fn();
    render(<Tags initial={['consumed', 'credit']} onTags={onTags} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove consumed' }));

    expect(onTags).toHaveBeenLastCalledWith(['credit']);
  });

  it('leaves the tags already added out of the suggestions', async () => {
    render(<Tags initial={['cancelMovement']} />);

    await userEvent.type(input(), 'cancel');

    expect(await screen.findByRole('option', { name: 'cancelAdjustment' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'cancelMovement' })).not.toBeInTheDocument();
  });
});
