import { Loader2Icon } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs once the close animation ends, e.g. to drop the content it was showing. */
  onOpenChangeComplete?: (open: boolean) => void;
  /** `false` for a dialog the user must answer, which has no close button. */
  closeButton?: boolean;
  /** `xl` for a dialog holding a table, such as a list to pick from. */
  size?: 'lg' | 'xl' | '2xl';
  /** `fixed` keeps the same height whatever the body shows, such as a table as it is filtered. */
  height?: 'auto' | 'fixed';
  children: ReactNode;
};

/** A dialog sized for a form, that stays inside the viewport and scrolls its body when it has to. */
export function FormDialog({
  open,
  onOpenChange,
  onOpenChangeComplete,
  closeButton = true,
  size = 'lg',
  height = 'auto',
  children,
}: FormDialogProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog
      // A click outside would throw away everything typed, so only Cancel, Close and Escape close it.
      disablePointerDismissal
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
      open={open}
    >
      <DialogContent
        // Until a field is there the popup holds focus; on touch it keeps it, so no keyboard pops up.
        initialFocus={() =>
          (!lastPressWasTouch && firstField(popupRef.current)) || popupRef.current
        }
        layout="scroll"
        ref={popupRef}
        showCloseButton={closeButton}
        height={height}
        size={size}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

const FIELD_SELECTOR = ['input:not([type=hidden])', 'textarea', 'select', 'button', '[tabindex]']
  .map(
    (control) =>
      `${control}:not(:disabled):not([hidden]):not([tabindex="-1"]):not([aria-disabled="true"])`,
  )
  .join(', ');

// A dialog opened from the URL never learns what opened it, so the last press is kept here.
let lastPressWasTouch = false;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (event) => {
      lastPressWasTouch = event.pointerType === 'touch';
    },
    true,
  );
  document.addEventListener(
    'keydown',
    () => {
      lastPressWasTouch = false;
    },
    true,
  );
}

/** The first field of the form's body; the footer's buttons are never where a form starts. */
function firstField(root: Element | null | undefined) {
  const form = root?.matches('form') ? root : root?.querySelector('form');
  const body = form?.querySelector('[data-slot=form-dialog-body]') ?? form;
  return body?.querySelector<HTMLElement>(FIELD_SELECTOR) ?? null;
}

// Long enough for a slow lookup to arrive, short enough that a late field never surprises anyone.
const WAIT_FOR_FIELD_MS = 10_000;

type FormDialogFormProps = {
  onSubmit: () => void;
  children: ReactNode;
};

/** Lays out the header, body and footer so only the body scrolls. */
export function FormDialogForm({ onSubmit, children }: FormDialogFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  // Moves focus from the popup to the first field once there is one, e.g. after a loading placeholder.
  useEffect(() => {
    const form = formRef.current;
    if (!form || lastPressWasTouch) return;
    const popup = form.closest('[role=dialog]');
    const observer = new MutationObserver(() => tryFocus());
    const stop = () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
    function tryFocus() {
      const active = document.activeElement;
      // Focus someone put on another part of the dialog is theirs to keep.
      if (active && active !== popup && popup?.contains(active)) return stop();
      const field = firstField(form);
      if (!field) return;
      field.focus();
      stop();
    }
    // A frame late, since a radio group makes its checked item tabbable only once it has mounted.
    const frame = requestAnimationFrame(tryFocus);
    const timer = setTimeout(stop, WAIT_FOR_FIELD_MS);
    observer.observe(form, {
      subtree: true,
      childList: true,
      attributeFilter: ['tabindex', 'disabled'],
    });
    return stop;
  }, []);

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4"
      noValidate
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

export function FormDialogHeader({ children }: { children: ReactNode }) {
  return (
    // Room at the end for the close button, so a long title never runs under it.
    <div className="pe-8">
      <DialogHeader spacing="tight">{children}</DialogHeader>
    </div>
  );
}

export function FormDialogTitle({ children }: { children: ReactNode }) {
  return <DialogTitle size="lg">{children}</DialogTitle>;
}

export function FormDialogDescription({ children }: { children: ReactNode }) {
  return <DialogDescription>{children}</DialogDescription>;
}

/** Scrolls on its own, so the header and footer stay in view on a short screen. */
export function FormDialogBody({ children }: { children: ReactNode }) {
  // Bleeds to the dialog's edges, so focus rings are not clipped and the scrollbar sits at the edge.
  return (
    <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 py-1" data-slot="form-dialog-body">
      {children}
    </div>
  );
}

export function FormDialogFooter({ children }: { children: ReactNode }) {
  return <DialogFooter>{children}</DialogFooter>;
}

type FormDialogCancelProps = {
  disabled?: boolean;
  children: ReactNode;
};

export function FormDialogCancel({ disabled = false, children }: FormDialogCancelProps) {
  return (
    <DialogClose disabled={disabled} render={<Button type="button" variant="outline" />}>
      {children}
    </DialogClose>
  );
}

type FormDialogSubmitProps = {
  pending?: boolean;
  disabled?: boolean;
  children: ReactNode;
};

export function FormDialogSubmit({
  pending = false,
  disabled = false,
  children,
}: FormDialogSubmitProps) {
  return (
    // Focusable while pending, so pressing it does not drop keyboard focus out of the dialog.
    <Button disabled={pending || disabled} focusableWhenDisabled={pending} type="submit">
      {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
      {children}
    </Button>
  );
}
