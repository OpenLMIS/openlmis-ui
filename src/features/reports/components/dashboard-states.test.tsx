import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { DashboardFailureState } from '@/features/reports/components/dashboard-states';
import { renderPage } from '@/test-utils/render-page';

it('focuses the offline error heading after a retry fails again', async () => {
  renderPage(<DashboardFailureState failure={{ kind: 'offline' }} onRetry={() => {}} focus />);
  expect(await screen.findByRole('heading', { name: 'offline.notice-title' })).toHaveFocus();
});
