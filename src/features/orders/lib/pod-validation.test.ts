import { describe, expect, it } from 'vitest';
import {
  POD_ERRORS,
  podAutoClear,
  returnedQuantity,
  validatePodFooter,
  validatePodLine,
} from '@/features/orders/lib/pod-validation';

const line = { accepted: '5', reason: '', vvm: '', notes: '' };
const shipped = { quantityShipped: 5, useVvm: false };
describe('POD validation', () => {
  it('clamps returned and treats blank as zero returned', () => {
    expect(returnedQuantity(5, '')).toBe(0);
    expect(returnedQuantity(5, '7')).toBe(0);
    expect(returnedQuantity(5, '-2')).toBe(5);
    expect(returnedQuantity(5, '2')).toBe(3);
  });
  it('requires whole accepted within shipped on confirm but allows blanks on save', () => {
    expect(validatePodLine({ ...line, accepted: '' }, shipped, 'confirm').accepted).toBe(
      POD_ERRORS.required,
    );
    expect(validatePodLine({ ...line, accepted: '' }, shipped, 'save')).toEqual({});
    expect(validatePodLine({ ...line, accepted: '6' }, shipped, 'confirm').accepted).toBe(
      POD_ERRORS.aboveShipped,
    );
    for (const accepted of ['1.5', '-1', 'x', '2147483648']) {
      expect(validatePodLine({ ...line, accepted }, shipped, 'save').accepted).toBeDefined();
    }
    expect(validatePodLine({ ...line, accepted: '٠' }, shipped, 'save')).toEqual({});
  });
  it('validates reason in both directions and permits clearing it', () => {
    expect(validatePodLine({ ...line, accepted: '3' }, shipped, 'confirm').reason).toBe(
      POD_ERRORS.reasonRequired,
    );
    expect(validatePodLine({ ...line, reason: 'r' }, shipped, 'confirm').reason).toBe(
      POD_ERRORS.reasonNotAllowed,
    );
    expect(validatePodLine(line, shipped, 'confirm')).toEqual({});
    expect(
      validatePodLine(
        { ...line, accepted: '', reason: 'r', vvm: 'STAGE_1' },
        { ...shipped, useVvm: true },
        'confirm',
      ),
    ).toEqual({ accepted: POD_ERRORS.required, reason: POD_ERRORS.reasonNotAllowed });
  });
  it('requires an allowed VVM stage for positive accepted on VVM lines, and forbids it at zero', () => {
    for (const vvm of ['', 'STAGE_3'])
      expect(validatePodLine({ ...line, vvm }, { ...shipped, useVvm: true }, 'confirm').vvm).toBe(
        POD_ERRORS.vvmRequired,
      );
    expect(
      validatePodLine({ ...line, vvm: 'STAGE_1' }, { ...shipped, useVvm: true }, 'confirm'),
    ).toEqual({});
    expect(
      validatePodLine(
        { ...line, accepted: '0', reason: 'r', vvm: 'STAGE_1' },
        { ...shipped, useVvm: true },
        'confirm',
      ).vvm,
    ).toBe(POD_ERRORS.vvmNotAllowed);
  });
  it('skips orphan line validation but blocks confirmation of blank quantities', () => {
    expect(
      validatePodLine({ ...line, accepted: 'bad' }, { ...shipped, quantityShipped: null }, 'save'),
    ).toEqual({});
    expect(
      validatePodLine({ ...line, accepted: '' }, { ...shipped, quantityShipped: null }, 'confirm')
        .accepted,
    ).toBe(POD_ERRORS.noShipment);
    expect(validatePodLine(line, { ...shipped, quantityShipped: null }, 'confirm')).toEqual({});
  });
  it('requires confirmation footer fields and compares received date in deployment time', () => {
    const fields = { receivedBy: '', deliveredBy: '', receivedDate: '' };
    expect(
      Object.keys(
        validatePodFooter(fields, 'confirm', 'Pacific/Honolulu', new Date('2026-11-11T01:00:00Z')),
      ),
    ).toEqual(['receivedBy', 'deliveredBy', 'receivedDate']);
    expect(validatePodFooter(fields, 'save', 'UTC')).toEqual({});
    expect(
      validatePodFooter(
        { ...fields, receivedDate: '2026-11-11' },
        'save',
        'Pacific/Honolulu',
        new Date('2026-11-11T01:00:00Z'),
      ).receivedDate,
    ).toBe(POD_ERRORS.futureDate);
  });
  it('clears dependencies only for valid numbers and never on blank while retyping', () => {
    for (const text of ['', 'bad', '1.5', '2147483648'])
      expect(podAutoClear(text, 5)).toEqual({ reason: false, vvm: false });
    expect(podAutoClear('5', 5)).toEqual({ reason: true, vvm: false });
    expect(podAutoClear('0', 5)).toEqual({ reason: false, vvm: true });
    expect(podAutoClear('0', 0)).toEqual({ reason: true, vvm: true });
  });
});
