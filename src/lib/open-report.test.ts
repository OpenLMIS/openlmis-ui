import { afterEach, describe, expect, it, vi } from 'vitest';
import { openReport } from '@/lib/open-report';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('openReport', () => {
  it('opens the PDF in a separate tab and releases its URL after opening', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:report');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const report = new Blob(['%PDF'], { type: 'application/pdf' });
    openReport(report);
    expect(createObjectURL).toHaveBeenCalledWith(report);
    expect(open).toHaveBeenCalledWith('blob:report', '_blank', 'noopener,noreferrer');
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report');
  });
});
