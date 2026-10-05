import { QueryClient } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslatedFormMessages } from '@/components/translated-form-messages';
import {
  createReason,
  createValidReason,
  deleteValidReason,
  fetchReasonCategories,
  fetchReasonTags,
  fetchReasonTypes,
  updateReason,
} from '@/features/reasons/api/api';
import { ReasonEditor } from '@/features/reasons/components/reason-editor';
import type { ValidReason } from '@/features/reasons/lib/types';
import { fetchFacilityTypes, fetchPrograms, fetchReasons } from '@/features/reference-data/api/api';
import type { Reason } from '@/features/reference-data/lib/types';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';
import en from '../../../../public/locales/en.json';

vi.mock('@/features/reasons/api/api', () => ({
  createReason: vi.fn(),
  updateReason: vi.fn(),
  createValidReason: vi.fn(),
  deleteValidReason: vi.fn(),
  fetchReasonTypes: vi.fn(),
  fetchReasonCategories: vi.fn(),
  fetchReasonTags: vi.fn(),
}));

vi.mock('@/features/reference-data/api/api', () => ({
  fetchPrograms: vi.fn(),
  fetchFacilityTypes: vi.fn(),
  fetchReasons: vi.fn(),
}));

const damage: Reason = {
  id: 'r1',
  name: 'Damage',
  description: 'Broken in transit',
  reasonType: 'DEBIT',
  reasonCategory: 'ADJUSTMENT',
  isFreeTextAllowed: false,
  tags: ['adjustment'],
};

const unpack: Reason = {
  ...damage,
  id: 'r2',
  name: 'Unpack Kit',
  reasonCategory: 'AGGREGATION',
  tags: [],
};

const valid = (
  id: string,
  programId: string,
  facilityTypeId: string,
  hidden = false,
): ValidReason => ({
  id,
  program: { id: programId },
  facilityType: { id: facilityTypeId },
  hidden,
  reason: { id: 'r1' },
});

function renderEditor(saved?: { reason: Reason; pairs: ValidReason[] }) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  renderPage(
    <TranslatedFormMessages>
      <ReasonEditor
        description="Description"
        discardDescription="Discard?"
        onCancel={onCancel}
        onSaved={onSaved}
        saved={saved}
        submitLabel={saved ? 'Save' : 'Create'}
        title="Reason"
      />
    </TranslatedFormMessages>,
    { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
  );
  return { onSaved, onCancel, user: userEvent.setup() };
}

async function pick(user: ReturnType<typeof userEvent.setup>, field: string, option: string) {
  await user.click(
    await screen.findByRole('combobox', { name: new RegExp(`^${field}`) }, { timeout: 5000 }),
  );
  await user.click(await screen.findByRole('option', { name: option }));
}

async function addPair(user: ReturnType<typeof userEvent.setup>, program: string, type: string) {
  await pick(user, 'Program', program);
  await pick(user, 'Facility Type', type);
  await user.click(screen.getByRole('button', { name: 'Add' }));
}

const pairsTable = () => screen.getByRole('table');

const findPairsTable = () => screen.findByRole('table', {}, { timeout: 5000 });

beforeAll(async () => {
  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      lng: 'en',
      fallbackLng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchReasonTypes).mockResolvedValue(['CREDIT', 'DEBIT']);
  vi.mocked(fetchReasonCategories).mockResolvedValue(['TRANSFER', 'ADJUSTMENT']);
  vi.mocked(fetchReasonTags).mockResolvedValue(['adjustment', 'consumed']);
  vi.mocked(fetchReasons).mockResolvedValue([damage, unpack]);
  vi.mocked(fetchPrograms).mockResolvedValue([
    { id: 'p1', code: 'PRG001', name: 'Essential Meds', active: true },
    { id: 'p2', code: 'PRG002', name: 'EPI', active: true },
  ]);
  vi.mocked(fetchFacilityTypes).mockImplementation(async (filter) =>
    [
      {
        id: 't1',
        code: 'hc',
        name: 'Health Center',
        displayOrder: 1,
        active: true,
        primaryHealthCare: true,
      },
      {
        id: 't2',
        code: 'old',
        name: 'Old Type',
        displayOrder: 2,
        active: false,
        primaryHealthCare: false,
      },
    ].filter((type) => !filter?.active || type.active),
  );
  vi.mocked(createReason).mockImplementation(async (body) => ({ id: 'new', ...body }));
  vi.mocked(updateReason).mockImplementation(async (id, body) => ({ ...body, id }));
  vi.mocked(createValidReason).mockImplementation(async (pair) => ({
    id: `v-${pair.program.id}`,
    ...pair,
  }));
  vi.mocked(deleteValidReason).mockResolvedValue();
});

describe('ReasonEditor', { timeout: 20_000 }, () => {
  it('asks for a name, a category and a type before sending anything', async () => {
    const { user } = renderEditor();

    await user.click(await screen.findByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Enter a name.')).toBeVisible();
    expect(screen.getByText('Choose a category.')).toBeVisible();
    expect(screen.getByText('Choose a type.')).toBeVisible();
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveFocus();
    expect(createReason).not.toHaveBeenCalled();
  });

  it("refuses another reason's name", async () => {
    const { user } = renderEditor();

    await user.type(await screen.findByRole('textbox', { name: /^Name/ }), 'damage');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Another reason already has this name.')).toBeVisible();
  });

  it('creates the reason with its tags and pairs, then reports it saved', async () => {
    const { user, onSaved } = renderEditor();

    await user.type(await screen.findByRole('textbox', { name: /^Name/ }), 'Expired');
    await pick(user, 'Category', 'Adjustment');
    await pick(user, 'Type', 'Debit');
    await user.click(screen.getByRole('switch', { name: 'Allow Free Text' }));
    await user.type(screen.getByRole('combobox', { name: /^Tags/ }), 'expired{Enter}');
    await addPair(user, 'EPI', 'Health Center');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createReason).toHaveBeenCalledWith({
      name: 'Expired',
      reasonCategory: 'ADJUSTMENT',
      reasonType: 'DEBIT',
      isFreeTextAllowed: true,
      tags: ['expired'],
    });
    expect(createValidReason).toHaveBeenCalledWith({
      program: { id: 'p2' },
      facilityType: { id: 't1' },
      hidden: false,
      reason: { id: 'new' },
    });
  });

  it('adds a pair with Show off, refuses the same pair twice, and removes one', async () => {
    const { user } = renderEditor();

    await pick(user, 'Program', 'EPI');
    await pick(user, 'Facility Type', 'Health Center');
    await user.click(screen.getByRole('switch', { name: /^Show$/ }));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const row = within(pairsTable()).getByText('EPI').closest('tr') as HTMLElement;
    expect(
      within(row).getByRole('switch', { name: 'Show For EPI, Health Center' }),
    ).not.toBeChecked();

    await addPair(user, 'EPI', 'Health Center');
    expect(
      await screen.findByText('This program and facility type are already listed.'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Remove EPI, Health Center' }));
    expect(await screen.findByText('Not Offered Anywhere Yet')).toBeVisible();
  });

  it('keeps the category and type of a saved reason, naming one the options lack', async () => {
    renderEditor({ reason: unpack, pairs: [valid('v1', 'p1', 't2')] });

    const category = await screen.findByRole('combobox', { name: /^Category/ }, { timeout: 5000 });
    expect(category).toHaveTextContent('Aggregation');
    expect(category).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /^Type/ })).toBeDisabled();
    expect(await within(await findPairsTable()).findByText('Old Type')).toBeVisible();
  });

  it('saves only what changed on a saved reason, keeping what the form does not show', async () => {
    const { user, onSaved } = renderEditor({
      reason: damage,
      pairs: [valid('v1', 'p1', 't1'), valid('v2', 'p2', 't1')],
    });

    const row = (await within(await findPairsTable()).findByText('Essential Meds')).closest(
      'tr',
    ) as HTMLElement;
    await user.click(
      within(row).getByRole('switch', { name: 'Show For Essential Meds, Health Center' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateReason).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ description: 'Broken in transit' }),
    );
    expect(deleteValidReason).toHaveBeenCalledExactlyOnceWith('v1');
    expect(createValidReason).toHaveBeenCalledExactlyOnceWith({
      program: { id: 'p1' },
      facilityType: { id: 't1' },
      hidden: true,
      reason: { id: 'r1' },
    });
  });

  it('names the pairs that failed, keeps the draft, and retries only those on the same reason', async () => {
    vi.mocked(createValidReason).mockRejectedValueOnce(httpError(500));
    const { user, onSaved } = renderEditor();

    await user.type(await screen.findByRole('textbox', { name: /^Name/ }), 'Expired');
    await pick(user, 'Category', 'Adjustment');
    await pick(user, 'Type', 'Debit');
    await addPair(user, 'EPI', 'Health Center');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Some Places Not Saved')).toBeVisible();
    expect(screen.getByText(/these places are not: EPI, Health Center/)).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
    expect(within(pairsTable()).getByText('EPI')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Create' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createReason).toHaveBeenCalledTimes(1);
    expect(updateReason).toHaveBeenCalledWith('new', expect.objectContaining({ name: 'Expired' }));
    expect(createValidReason).toHaveBeenCalledTimes(2);
  });

  it("shows the server's reason when the reason itself is refused", async () => {
    vi.mocked(updateReason).mockRejectedValue(httpError(400, { message: 'Tags are invalid.' }));
    const { user } = renderEditor({ reason: damage, pairs: [] });

    await user.click(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Could Not Save Reason')).toBeVisible();
    expect(screen.getByText('Tags are invalid.')).toBeVisible();
  });
});
