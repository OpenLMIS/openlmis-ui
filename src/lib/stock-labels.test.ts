import { describe, expect, it } from 'vitest';
import {
  eventLinks,
  namedWithFreeText,
  reasonLabel,
  type StockReason,
  stockProductName,
} from '@/lib/stock-labels';

const reason = (
  name: string,
  reasonType = 'CREDIT',
  reasonCategory = 'ADJUSTMENT',
): StockReason => ({
  name,
  reasonType,
  reasonCategory,
});

describe('stock labels', () => {
  it('names sources and destinations only when an object exists', () => {
    expect(namedWithFreeText(null, 'Elsewhere')).toBe('');
    expect(namedWithFreeText({ name: 'Clinic' })).toBe('Clinic');
    expect(namedWithFreeText({ name: 'Clinic' }, 'Ward 1')).toBe('Clinic: Ward 1');
  });

  it('uses free text before the physical inventory label and leaves no reason blank', () => {
    expect(reasonLabel({}, 'Physical Inventory')).toBe('');
    expect(reasonLabel({ reason: reason('Loss') }, 'Physical Inventory')).toBe('Loss');
    const inventory = { reason: reason('Overstock', 'CREDIT', 'PHYSICAL_INVENTORY') };
    expect(reasonLabel(inventory, 'Physical Inventory')).toBe('Physical Inventory');
    expect(reasonLabel({ ...inventory, reasonFreeText: 'Counted' }, 'Physical Inventory')).toBe(
      'Overstock: Counted',
    );
  });

  it('adds the display unit only when supplied', () => {
    expect(
      stockProductName({ fullProductName: 'Vaccine', dispensable: { displayUnit: 'each' } }),
    ).toBe('Vaccine - each');
    expect(stockProductName({ fullProductName: 'Vaccine' })).toBe('Vaccine');
  });
});

describe('eventLinks', () => {
  it('links nothing without an origin or a reversal', () => {
    expect(eventLinks({ documentNumber: 'Hidden', originEventId: 'event0' }, 'No Number')).toEqual({
      document: null,
      reversing: null,
      reversedBy: null,
    });
  });

  it('links each document to its own event', () => {
    expect(
      eventLinks(
        {
          eventOrigin: 'ISSUE',
          originEventId: 'event0',
          documentNumber: 'DOC-1',
          reversedEventId: 'event1',
          reversedEventDocumentNumber: 'DOC-2',
          cancellationEventId: 'event2',
          cancellationEventDocumentNumber: 'DOC-3',
        },
        'No Number',
      ),
    ).toEqual({
      document: { label: 'DOC-1', eventId: 'event0' },
      reversing: { label: 'DOC-2', eventId: 'event1' },
      reversedBy: { label: 'DOC-3', eventId: 'event2' },
    });
  });

  it('falls back to No Number and keeps a document without an event as text', () => {
    expect(
      eventLinks(
        { eventOrigin: 'ISSUE', reversedEventId: 'event1', cancellationEventId: 'event2' },
        'No Number',
      ),
    ).toEqual({
      document: { label: 'No Number' },
      reversing: { label: 'No Number', eventId: 'event1' },
      reversedBy: { label: 'No Number', eventId: 'event2' },
    });
  });
});
