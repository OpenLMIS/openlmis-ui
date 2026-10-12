import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EventHeader } from '@/features/stock-events/components/event-header';

vi.mock('@/hooks/use-deployment-time-zone', () => ({ useDeploymentTimeZone: () => 'UTC' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const event = {
  id: 'event',
  facilityId: 'facility',
  programId: 'program',
  signature: 'Signed',
  username: 'User',
};

describe('EventHeader', () => {
  it('shows the signature by default', () => {
    render(<EventHeader event={event} />);
    expect(screen.getByText('stock-event.signature')).toBeInTheDocument();
    expect(screen.getByText('Signed')).toBeInTheDocument();
  });
  it('leaves signature out of a reverse header', () => {
    render(<EventHeader event={event} showSignature={false} />);
    expect(screen.queryByText('stock-event.signature')).not.toBeInTheDocument();
    expect(screen.queryByText('Signed')).not.toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
  });
});
