import { type HistoryState, useNavigate, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { SearchChange } from '@/lib/table-search';

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: router types extend by interface merging.
  interface HistoryState {
    /** On an entry a page pushed to open a dialog, so closing it can step Back. */
    dialogOpenedHere?: boolean;
  }
}

/** The mark an opened dialog's entry carries, so closing it steps Back; also for a `Link` that opens one. */
export const markDialogOpened = (previous: HistoryState): HistoryState => ({
  ...previous,
  dialogOpenedHere: true,
});

/** The current page's URL state: change its search, and open and close the dialog the URL owns. */
export function useSearchNavigation<TSearch extends object>(closedDialogs: Partial<TSearch>) {
  const router = useRouter();
  const navigate = useNavigate();
  // The page passes its own search type; the router cannot know which page calls this.
  const withSearch = useCallback(
    (
      search: (previous: TSearch) => TSearch,
      options: { replace?: boolean; mark?: boolean; resetScroll?: boolean },
    ) =>
      navigate({
        to: '.',
        search: search as never,
        replace: options.replace,
        resetScroll: options.resetScroll,
        state: options.mark ? markDialogOpened : undefined,
      }),
    [navigate],
  );

  const updateSearch = useCallback<SearchChange<TSearch>>(
    (update, replace = false, options) =>
      void withSearch(
        (previous) => ({
          ...previous,
          ...(typeof update === 'function' ? update(previous) : update),
        }),
        { replace, resetScroll: options?.resetScroll },
      ),
    [withSearch],
  );
  // Opening marks the entry it pushes, so closing steps Back, even after Forward reopened it.
  const openDialog = useCallback(
    (params: Partial<TSearch>) =>
      withSearch((previous) => ({ ...previous, ...closedDialogs, ...params }), {
        mark: true,
        resetScroll: false,
      }),
    [withSearch, closedDialogs],
  );
  const closeDialog = useCallback(() => {
    if (router.state.location.state.dialogOpenedHere) router.history.back();
    else updateSearch(closedDialogs, true, { resetScroll: false });
  }, [router, updateSearch, closedDialogs]);

  return { updateSearch, openDialog, closeDialog };
}
