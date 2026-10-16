export function hasOpenDialog({
  exclude,
  modalOnly = false,
}: {
  exclude?: Element | null;
  modalOnly?: boolean;
} = {}) {
  return Array.from(
    document.querySelectorAll(
      '[role="dialog"]:not([data-closed]):not([hidden]):not([aria-hidden="true"]), ' +
        '[role="alertdialog"]:not([data-closed]):not([hidden]):not([aria-hidden="true"]), dialog[open]',
    ),
  ).some(
    (dialog) =>
      dialog !== exclude &&
      (!modalOnly ||
        dialog.matches(
          '[data-slot="dialog-content"], [data-slot="alert-dialog-content"], ' +
            '[data-slot="sheet-content"], [aria-modal="true"], dialog[open]',
        )),
  );
}
