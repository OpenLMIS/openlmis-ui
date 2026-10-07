import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFile } from '@/lib/download-file';
import { openReport } from '@/lib/open-report';

vi.mock('@/lib/download-file', () => ({ downloadFile: vi.fn() }));
const tab = { location: { href: 'about:blank' }, close: vi.fn(), closed: false };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
  URL.createObjectURL = vi.fn(() => 'blob:report');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('openReport', () => {
  it('opens immediately, delivers into that tab, then releases the URL', () => {
    vi.useFakeTimers();
    const delivery = openReport('card.pdf');
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    const report = new Blob(['%PDF'], { type: 'application/pdf' });
    delivery.deliver(report);
    expect(tab.location.href).toBe('blob:report');
    expect(URL.createObjectURL).toHaveBeenCalledWith(report);
    expect(downloadFile).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
  });

  it('downloads when the waiting tab was closed', () => {
    const delivery = openReport('card.pdf');
    tab.closed = true;
    const report = new Blob(['%PDF']);
    delivery.deliver(report);
    expect(downloadFile).toHaveBeenCalledWith(report, 'card.pdf');
    tab.closed = false;
  });

  it('exposes closing the waiting tab', () => {
    openReport('card.pdf').close();
    expect(tab.close).toHaveBeenCalled();
  });
});
