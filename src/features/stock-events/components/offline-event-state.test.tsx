import { render as renderCell, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { expect, it } from 'vitest';
import { OfflineEventErrorMessage } from '@/features/stock-events/components/offline-event-state';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { IsolatingICU } from '@/lib/isolate-values';
import ar from '../../../../public/locales/ar.json';

function fixture(
  name: string,
  status: 'refused' | 'uncertain',
  sequence: number,
  timestamp: number,
): DeviceEvent {
  const event: QueuedStockEvent = {
    localEventId: name,
    draftId: name,
    revision: 1,
    kind: 'adjustment',
    userId: 'u',
    facilityId: 'f',
    programId: 'p',
    facility: { id: 'f', code: 'F', name },
    program: { id: 'p', code: 'P', name: 'Program' },
    status: 'uncertain',
    sequence,
    queuedAt: timestamp,
    lines: [],
    postBody: '',
    payload: { facilityId: 'f', programId: 'p', lineItems: [] },
  };
  return {
    ...event,
    status,
    error: {
      localEventId: name,
      facilityId: 'f',
      programId: 'p',
      event,
      category: status,
      message: '',
      failedAt: timestamp,
    },
  };
}

it('isolates refusal details in Arabic and uses a neutral fallback for copied refusals', async () => {
  const i18n = createInstance().use(IsolatingICU);
  await i18n.init({
    lng: 'ar',
    keySeparator: false,
    nsSeparator: false,
    resources: { ar: { translation: ar } },
  });
  const renderMessage = (event: DeviceEvent) =>
    renderCell(
      <I18nextProvider i18n={i18n}>
        <OfflineEventErrorMessage event={event} />
      </I18nextProvider>,
    );
  const refused = fixture('Refused', 'refused', 1, 10);
  const uncertain = fixture('Uncertain', 'uncertain', 2, 20);
  if (!refused.error || !uncertain.error) throw new Error('Missing fixture errors');
  refused.error = { ...refused.error, message: 'Human refusal', messageKey: 'server.key' };
  uncertain.error = {
    ...uncertain.error,
    message: 'Stored English transport failure',
    response: 'Secret response',
  };
  uncertain.lastFailure = 'Stored last failure';
  const { unmount } = renderMessage(refused);
  expect(screen.getByText(/Human refusal/)).toHaveTextContent(
    'تعذر علينا تنفيذ هذا الحدث. \u2068Human refusal\u2069',
  );
  unmount();
  refused.error.message = '';
  const fallback = renderMessage(refused);
  expect(screen.getByText(/لا تتوفر تفاصيل، حاول إعادة إرسال الحدث/)).toBeVisible();
  fallback.unmount();
  refused.error.message = 'server.key';
  const keyFallback = renderMessage(refused);
  expect(screen.getByText(/لا تتوفر تفاصيل، حاول إعادة إرسال الحدث/)).toBeVisible();
  expect(screen.queryByText('server.key')).not.toBeInTheDocument();
  keyFallback.unmount();
  refused.error.resolvedAt = 100;
  const copied = renderMessage(refused);
  expect(screen.getByText(/لا تتوفر تفاصيل\./)).toBeVisible();
  expect(screen.queryByText(/حاول إعادة إرسال/)).not.toBeInTheDocument();
  copied.unmount();
  renderMessage(uncertain);
  expect(screen.getByText(ar['offline-events.error-uncertain'])).toBeVisible();
  expect(screen.queryByText(/Stored|Secret response/)).not.toBeInTheDocument();
});
