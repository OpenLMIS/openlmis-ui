import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { RoleTabsSkeleton } from '@/features/users/components/role-tabs';
import { ROLE_TABS } from '@/features/users/lib/role-assignments';

const [, , reports] = ROLE_TABS;

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: 'cimode', keySeparator: false, nsSeparator: false });
});

describe('RoleTabsSkeleton', () => {
  it('holds the real tabs with the open one selected while the roles load', () => {
    render(<RoleTabsSkeleton compact={false} search={{}} tab={reports} />);

    expect(screen.getAllByRole('tab')).toHaveLength(ROLE_TABS.length);
    expect(screen.getByRole('tab', { name: reports.labelKey })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
