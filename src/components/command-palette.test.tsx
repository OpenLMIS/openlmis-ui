import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CommandPalette } from '@/components/command-palette';
import { rightsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import { renderPage } from '@/tests/render-page';

function renderPalette(rights: string[]) {
  useLoginData.setState({ referenceDataUserId: 'u1', username: 'admin' });
  const queryClient = new QueryClient();
  queryClient.setQueryData(rightsOptions('u1').queryKey, new Set(rights));
  renderPage(<CommandPalette />, { queryClient });
}

afterEach(() => useLoginData.setState({ referenceDataUserId: null, username: null }));

describe('CommandPalette', () => {
  it('offers Account and, with the right, Settings', async () => {
    renderPalette(['SYSTEM_SETTINGS_MANAGE']);

    await userEvent.keyboard('{Control>}k{/Control}');

    expect(await screen.findByRole('option', { name: 'nav-user.account' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'nav-user.settings' })).toBeInTheDocument();
  });

  it('leaves Settings out for someone without the right', async () => {
    renderPalette(['USERS_MANAGE']);

    await userEvent.keyboard('{Control>}k{/Control}');

    expect(await screen.findByRole('option', { name: 'nav-user.account' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'nav-user.settings' })).not.toBeInTheDocument();
  });
});
