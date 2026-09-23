import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataTableSearch } from '@/components/data-table/data-table-search';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DataTableSearch', () => {
  it('reports once typing pauses, not on every keystroke', () => {
    const onValueChange = vi.fn();
    render(<DataTableSearch onValueChange={onValueChange} placeholder="Search" value="" />);
    const input = screen.getByRole('textbox', { name: 'Search' });

    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ad' } });
    expect(onValueChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenCalledWith('ad');
  });

  it('clears immediately', () => {
    const onValueChange = vi.fn();
    render(<DataTableSearch onValueChange={onValueChange} placeholder="Search" value="admin" />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }));

    expect(onValueChange).toHaveBeenCalledWith('');
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('');
  });

  it('follows a value reset from outside', () => {
    const { rerender } = render(
      <DataTableSearch onValueChange={vi.fn()} placeholder="Search" value="admin" />,
    );

    rerender(<DataTableSearch onValueChange={vi.fn()} placeholder="Search" value="" />);

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('');
  });

  it('keeps typing that arrived while its own last value was on the way back', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <DataTableSearch onValueChange={onValueChange} placeholder="Search" value="" />,
    );
    const input = screen.getByRole('textbox', { name: 'Search' });

    fireEvent.change(input, { target: { value: 'ad' } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(input, { target: { value: 'adm' } });
    rerender(<DataTableSearch onValueChange={onValueChange} placeholder="Search" value="ad" />);

    expect(input).toHaveValue('adm');
  });

  it('keeps a trailing space when its own value comes back', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <DataTableSearch onValueChange={onValueChange} placeholder="Search" value="" />,
    );
    const input = screen.getByRole('textbox', { name: 'Search' });

    fireEvent.change(input, { target: { value: 'da ' } });
    act(() => vi.advanceTimersByTime(300));
    rerender(<DataTableSearch onValueChange={onValueChange} placeholder="Search" value="da " />);
    fireEvent.change(input, { target: { value: 'da s' } });

    expect(input).toHaveValue('da s');
  });

  it('sends pending typing when the field loses focus', () => {
    const onValueChange = vi.fn();
    render(<DataTableSearch onValueChange={onValueChange} placeholder="Search" value="" />);
    const input = screen.getByRole('textbox', { name: 'Search' });

    fireEvent.change(input, { target: { value: 'jo' } });
    fireEvent.blur(input);

    expect(onValueChange).toHaveBeenCalledWith('jo');
    act(() => vi.advanceTimersByTime(300));
    expect(onValueChange).toHaveBeenCalledOnce();
  });

  it('sends pending typing instead of dropping it when unmounted', () => {
    const onValueChange = vi.fn();
    const { unmount } = render(
      <DataTableSearch onValueChange={onValueChange} placeholder="Search" value="" />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'jo' } });
    unmount();

    expect(onValueChange).toHaveBeenCalledWith('jo');
  });
});
