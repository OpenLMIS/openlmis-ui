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
  children: ReactNode;
};

/** A dialog sized for a form, that stays inside the viewport and scrolls its body when it has to. */
export function FormDialog({
  open,
  onOpenChange,
  onOpenChangeComplete,
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
        // Until the form is there, the popup holds focus, so no placeholder button takes it and vanishes.
        initialFocus={() => firstField(popupRef.current?.querySelector('form')) ?? popupRef.current}
        layout="scroll"
        ref={popupRef}
        size="lg"
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

const FIELD_SELECTOR = ['input:not([type=hidden])', 'textarea', 'select', 'button', '[tabindex]']
  .map((control) => `${control}:not(:disabled):not([tabindex="-1"]):not([aria-disabled="true"])`)
  .join(', ');

const firstField = (root: Element | null | undefined) =>
  root?.querySelector<HTMLElement>(FIELD_SELECTOR) ?? null;

type FormDialogFormProps = {
  onSubmit: () => void;
  children: ReactNode;
};

/** Lays out the header, body and footer so only the body scrolls. */
export function FormDialogForm({ onSubmit, children }: FormDialogFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  // Takes focus from the popup or the page a frame late, once a radio group has made its checked item tabbable.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      const popup = formRef.current?.closest('[role=dialog]');
      if (active && active !== document.body && active !== popup) return;
      firstField(formRef.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
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
  return <DialogDescription size="sm">{children}</DialogDescription>;
}

/** Scrolls on its own, so the header and footer stay in view on a short screen. */
export function FormDialogBody({ children }: { children: ReactNode }) {
  // Bleeds to the dialog's edges, so focus rings are not clipped and the scrollbar sits at the edge.
  return <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 py-1">{children}</div>;
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
    <Button disabled={pending || disabled} type="submit">
      {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
      {children}
    </Button>
  );
}
