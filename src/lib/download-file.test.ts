import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadFile } from '@/lib/download-file';

afterEach(() => vi.restoreAllMocks());

describe('downloadFile', () => {
  it('saves the file under its name and lets go of its address afterwards', () => {
    const createObjectURL = vi.fn(() => 'blob:report');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers();

    downloadFile(new Blob(['%PDF']), 'stock-on-hand.pdf');

    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('stock-on-hand.pdf');
    expect(anchor.href).toBe('blob:report');
    expect(anchor.isConnected).toBe(false);
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report');
    vi.useRealTimers();
  });
});
