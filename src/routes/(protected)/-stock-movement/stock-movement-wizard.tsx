import { useForm, useStore } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { ClipboardCheckIcon, MapPinIcon, PackageIcon, TagIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { type StepMeta, Stepper } from '@/components/stepper';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CreateStockMovementError, createStockMovement } from '@/features/stock-movement/api/api';
import {
  DEFAULT_STOCK_MOVEMENT,
  stepSchemas,
  stockMovementSchema,
} from '@/features/stock-movement/lib/types';
import { StepItems } from '@/routes/(protected)/-stock-movement/step-items';
import { StepLocations } from '@/routes/(protected)/-stock-movement/step-locations';
import { StepReview } from '@/routes/(protected)/-stock-movement/step-review';
import { StepType } from '@/routes/(protected)/-stock-movement/step-type';
import { WizardActions } from '@/routes/(protected)/-stock-movement/wizard-actions';

const STEPS: readonly StepMeta[] = [
  { label: 'Type', icon: TagIcon },
  { label: 'Locations', icon: MapPinIcon },
  { label: 'Items', icon: PackageIcon },
  { label: 'Review', icon: ClipboardCheckIcon },
] as const;

export type WizardFormApi = ReturnType<typeof useStockMovementForm>;

/*
  Extracted hook so step components can accept the form instance as a
  strongly-typed prop without depending on a React context. Keeps the
  wizard orchestrator the single source of truth for form lifecycle.
*/
function useStockMovementForm(onComplete: () => Promise<void>) {
  return useForm({
    defaultValues: DEFAULT_STOCK_MOVEMENT,
    validators: { onSubmit: stockMovementSchema },
    onSubmit: async ({ value }) => {
      try {
        await createStockMovement(value);
        toast.success('Stock movement recorded.');
        await onComplete();
      } catch (error) {
        if (error instanceof CreateStockMovementError) {
          toast.error(error.message);
        } else {
          toast.error('Something went wrong. Please try again.');
        }
      }
    },
  });
}

export function StockMovementWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const stepAnchorRef = useRef<HTMLDivElement | null>(null);

  const form = useStockMovementForm(async () => {
    await navigate({ to: '/dashboard' });
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const isDirty = useStore(form.store, (state) => state.isDirty);
  const isLastStep = currentStep === stepSchemas.length - 1;
  const isFirstStep = currentStep === 0;

  /*
    Move focus to the step container when the step changes. Screen
    readers announce the new heading, and keyboard users land inside
    the step content rather than at the top of the page. `currentStep`
    is the explicit trigger - ref reads alone don't establish a dep
    but the lint tooling expects it listed for intent clarity.
  */
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus effect must re-fire on every step change even though the body only touches a ref
  useEffect(() => {
    stepAnchorRef.current?.focus();
  }, [currentStep]);

  function goBack() {
    if (isFirstStep) return;
    setCurrentStep((step) => step - 1);
  }

  async function goNext() {
    const schema = stepSchemas[currentStep];
    if (!schema) return;
    const result = schema.safeParse(form.state.values);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const name = issue.path.join('.');
        if (!name) continue;
        /*
          `errors` on AnyFieldMetaBase is derived (read-only);
          TanStack Form computes it from `errorMap`. Writing
          `errorMap.onSubmit` classifies this as a submission-time
          gate that auto-clears on the field's next onChange cycle.
        */
        // biome-ignore lint/suspicious/noExplicitAny: setFieldMeta's field name is typed per-key; `name` is built dynamically
        form.setFieldMeta(name as any, (prev) => ({
          ...prev,
          errorMap: { ...prev.errorMap, onSubmit: issue.message },
        }));
      }
      return;
    }
    if (isLastStep) {
      await form.handleSubmit();
    } else {
      setCurrentStep((step) => step + 1);
    }
  }

  function jumpToStep(index: number) {
    if (index < currentStep) setCurrentStep(index);
  }

  function handleReset() {
    form.reset();
    setCurrentStep(0);
  }

  return (
    <Card surface="background">
      <CardHeader>
        <CardTitle>New stock movement</CardTitle>
        <CardDescription>
          Record inventory moving between warehouses. Each step validates before you continue.
        </CardDescription>
        <div className="pt-2">
          <Stepper steps={STEPS} current={currentStep} onStepClick={jumpToStep} />
        </div>
      </CardHeader>
      <CardContent>
        {/*
          Focus anchor - receives keyboard focus on step change so
          assistive tech announces the new step context.
        */}
        {/*
          Focusable but not interactive - a step container. Leaving off
          an ARIA role avoids forcing `<fieldset>` semantics on what is
          really a scroll/focus anchor; the step's own `<h2>` inside
          this wrapper is announced once focus lands.
        */}
        <div ref={stepAnchorRef} tabIndex={-1} className="flex flex-col gap-5 outline-none">
          <WizardStep index={currentStep} form={form} onJumpToStep={setCurrentStep} />
        </div>
      </CardContent>
      <CardFooter>
        <WizardActions
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          isSubmitting={isSubmitting}
          isDirty={isDirty}
          onBack={goBack}
          onNext={goNext}
          onReset={handleReset}
        />
      </CardFooter>
    </Card>
  );
}

type WizardStepProps = {
  index: number;
  form: WizardFormApi;
  onJumpToStep: (index: number) => void;
};

function WizardStep({ index, form, onJumpToStep }: WizardStepProps) {
  switch (index) {
    case 0:
      return <StepType form={form} />;
    case 1:
      return <StepLocations form={form} />;
    case 2:
      return <StepItems form={form} />;
    case 3:
      return <StepReview form={form} onEditStep={onJumpToStep} />;
    default:
      return null;
  }
}
