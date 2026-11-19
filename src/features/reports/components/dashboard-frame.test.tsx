import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { PageVisibility } from '@/components/shared/page-visibility';
import { FRAME_LOAD_LIMIT_MS } from '@/features/reports/components/dashboard-states';
import { DashboardViewer } from '@/features/reports/components/dashboard-viewer';

const report = {
  id: 'r1',
  name: 'Power BI Sales',
  type: 'POWERBI',
  url: 'https://app.powerbi.com/view?r=abc',
};

let setHidden: (hidden: boolean) => void = () => {};
function Harness() {
  const [hidden, set] = useState(false);
  setHidden = set;
  return (
    <PageVisibility hidden={hidden}>
      <DashboardViewer report={report} supersetUrl={undefined} userId="ada" username="ada" />
    </PageVisibility>
  );
}

afterEach(() => vi.useRealTimers());

it('shows Did Not Load when the frame never loads, and keeps recovery after a load', () => {
  vi.useFakeTimers();
  render(<Harness />);
  const frame = screen.getByTitle('Power BI Sales');
  expect(frame).toHaveAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-presentation',
  );
  expect(screen.getByRole('link', { name: 'reports.dashboard.open-new-tab' })).toHaveAttribute(
    'href',
    report.url,
  );

  act(() => vi.advanceTimersByTime(FRAME_LOAD_LIMIT_MS));

  expect(screen.getByRole('alert')).toHaveTextContent('reports.dashboard.did-not-load-title');
  expect(screen.queryByTitle('Power BI Sales')).not.toBeInTheDocument();

  const retry = screen.getByRole('button', { name: 'error.try-again' });
  act(() => retry.focus());
  fireEvent.click(retry);
  fireEvent.load(screen.getByTitle('Power BI Sales'));
  act(() => vi.advanceTimersByTime(FRAME_LOAD_LIMIT_MS));

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'error.try-again' })).toHaveFocus();
  expect(screen.getByRole('link', { name: 'reports.dashboard.open-new-tab' })).toBeInTheDocument();
});

it('leaves focus where the user moved it while a retry was loading', () => {
  vi.useFakeTimers();
  render(
    <>
      <a href="/reports">View Reports</a>
      <Harness />
    </>,
  );
  const retry = screen.getByRole('button', { name: 'error.try-again' });
  act(() => retry.focus());
  fireEvent.click(retry);
  const breadcrumb = screen.getByRole('link', { name: 'View Reports' });
  act(() => breadcrumb.focus());

  act(() => vi.advanceTimersByTime(FRAME_LOAD_LIMIT_MS));

  expect(screen.getByRole('alert')).toBeVisible();
  expect(breadcrumb).toHaveFocus();
});

it('removes the frame while the app is hidden and starts one fresh deadline on return', () => {
  vi.useFakeTimers();
  render(<Harness />);
  const old = screen.getByTitle('Power BI Sales');
  act(() => vi.advanceTimersByTime(FRAME_LOAD_LIMIT_MS - 1000));

  act(() => setHidden(true));
  expect(screen.queryByTitle('Power BI Sales')).not.toBeInTheDocument();
  act(() => setHidden(false));
  fireEvent.load(old);
  act(() => vi.advanceTimersByTime(FRAME_LOAD_LIMIT_MS - 1000));

  expect(screen.getAllByTitle('Power BI Sales')).toHaveLength(1);
  expect(screen.getByTitle('Power BI Sales')).not.toBe(old);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('alert')).toHaveTextContent('reports.dashboard.did-not-load-title');
});
