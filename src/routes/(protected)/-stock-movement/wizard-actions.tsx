import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from 'lucide-react';
import { ConfirmResetButton } from '@/components/confirm-reset-button';
import { Button } from '@/components/ui/button';

export type WizardActionsProps = {
  isFirstStep: boolean;
  isLastStep: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  onBack: () => void;
  onNext: () => void;
  onReset: () => void;
};

export function WizardActions({
  isFirstStep,
  isLastStep,
  isSubmitting,
  isDirty,
  onBack,
  onNext,
  onReset,
}: WizardActionsProps) {
  /*
    Mobile-first stacking: flex-col-reverse below @sm/main puts the
    primary action (Next/Submit) visually above Back so the thumb
    lands on it first. Reset is a tertiary action, hidden until the
    form is dirty to keep the footer calm on first render, and
    gated behind a confirm dialog so an accidental click doesn't
    wipe a long wizard.
  */
  return (
    <div className="flex w-full flex-col-reverse gap-2 @sm/main:flex-row @sm/main:items-center">
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        disabled={isFirstStep || isSubmitting}
        className="w-full @sm/main:w-auto"
      >
        <ChevronLeftIcon data-icon="inline-start" />
        Back
      </Button>
      {isDirty && (
        <ConfirmResetButton
          onConfirm={onReset}
          disabled={isSubmitting}
          variant="ghost"
          showIcon
          title="Reset the wizard?"
          description="All steps will be cleared and you'll return to step 1. This cannot be undone."
          className="w-full @sm/main:w-auto"
        />
      )}
      <Button
        type="button"
        onClick={onNext}
        disabled={isSubmitting}
        className="w-full @sm/main:ml-auto @sm/main:w-auto"
      >
        {isSubmitting && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
        {isLastStep ? 'Submit' : 'Next'}
        {!isLastStep && !isSubmitting && <ChevronRightIcon data-icon="inline-end" />}
      </Button>
    </div>
  );
}
