import { act, renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, expect, it } from 'vitest';
import { useToastOffset } from '@/hooks/use-toast-offset';

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  document.body.replaceChildren();
});

it('moves an open toast below a header action that appears later, however low', async () => {
  const header = document.createElement('div');
  header.dataset.slot = 'workspace-header';
  const actions = document.createElement('div');
  actions.dataset.slot = 'workspace-actions';
  header.append(actions);
  document.body.append(header);
  const { result } = renderHook(() => useToastOffset());
  act(() => {
    toast('Saved');
  });
  await waitFor(() => expect(result.current.top).toContain(', 0px))'));
  const button = document.createElement('button');
  button.getBoundingClientRect = () => ({ top: 552, bottom: 588, left: 0, right: 100 }) as DOMRect;
  button.getClientRects = () => [button.getBoundingClientRect()] as unknown as DOMRectList;
  actions.append(button);
  await waitFor(() =>
    expect(result.current.top).toBe('calc(16px + max(var(--app-header-height, 0px), 588px))'),
  );
});
