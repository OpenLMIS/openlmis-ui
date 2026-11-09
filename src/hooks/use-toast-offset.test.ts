import { act, renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, expect, it, vi } from 'vitest';
import { useToastOffset } from '@/hooks/use-toast-offset';

vi.mock('@tanstack/react-router', () => ({ useLocation: () => '/requisitions/r1' }));

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  document.body.replaceChildren();
});

it('keeps a toast below a header action however low it sits', async () => {
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
  const button = document.createElement('button');
  button.getBoundingClientRect = () => ({ top: 552, bottom: 588, left: 0, right: 100 }) as DOMRect;
  button.getClientRects = () => [button.getBoundingClientRect()] as unknown as DOMRectList;
  actions.append(button);
  await waitFor(() =>
    expect(result.current.top).toBe('calc(16px + max(var(--app-header-height, 0px), 588px))'),
  );
});
