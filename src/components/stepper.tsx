import { CheckIcon, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type StepMeta = {
  label: string;
  icon: LucideIcon;
};

export type StepperProps = {
  steps: readonly StepMeta[];
  current: number;
  /*
    Fires only when the user clicks a completed step (index < current).
    Callers can use this to jump back for edits; upcoming steps stay
    inert so users can't skip validation gates.
  */
  onStepClick?: (index: number) => void;
  className?: string;
};

type StepState = 'upcoming' | 'active' | 'completed';

function stateOf(index: number, current: number): StepState {
  if (index < current) return 'completed';
  if (index === current) return 'active';
  return 'upcoming';
}

export function Stepper({ steps, current, onStepClick, className }: StepperProps) {
  const total = steps.length;
  const activeStep = steps[current];
  /*
    Fills only after each completed step - step 0 shows 0%, last step
    shows ((total - 1) / total) * 100; the bar reaches 100% when the
    wizard submits and the parent unmounts this component. Using
    `(current + 1) / total` would already show 25% on step 0 of a
    4-step wizard, which overstates progress before any input.
  */
  const progressValue = Math.round((current / total) * 100);

  return (
    <div className={cn('w-full', className)}>
      {/*
        Compact view for very narrow containers (< @sm/main). Shows
        "Step X of Y - <label>" + a Progress bar so the card header
        doesn't wrap or clip on a phone.
      */}
      <div className="flex flex-col gap-2 @sm/main:hidden" aria-hidden="true">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">
            Step {current + 1} of {total}
          </span>
          <span className="truncate text-sm text-muted-foreground">{activeStep?.label}</span>
        </div>
        <Progress value={progressValue} />
      </div>

      {/*
        Full horizontal stepper (≥ @sm/main). Each step is a square
        icon card plus a stacked "STEP N / label / status" column.
        Completed squares are clickable; upcoming squares are inert.
        Connectors fill the gap between squares and tint primary when
        the preceding step is complete.
      */}
      <ol className="hidden items-start gap-2 @sm/main:flex">
        {steps.map((step, index) => {
          const state = stateOf(index, current);
          const canClick = state === 'completed' && Boolean(onStepClick);
          const isLast = index === total - 1;
          return (
            <li
              key={step.label}
              aria-current={state === 'active' ? 'step' : undefined}
              className="flex min-w-0 flex-1 flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <StepIcon
                  index={index}
                  step={step}
                  state={state}
                  canClick={canClick}
                  onClick={canClick ? () => onStepClick?.(index) : undefined}
                />
                {!isLast && <StepConnector state={state} />}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-2xs font-semibold uppercase tracking-label text-muted-foreground">
                  Step {index + 1}
                </span>
                <span
                  className={cn(
                    'truncate text-sm',
                    state === 'upcoming' ? 'text-muted-foreground' : 'font-medium text-foreground',
                  )}
                  title={step.label}
                >
                  {step.label}
                </span>
                <div className="hidden @md/main:inline-flex">
                  <StatusBadge state={state} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type StepIconProps = {
  index: number;
  step: StepMeta;
  state: StepState;
  canClick: boolean;
  onClick?: () => void;
};

function StepIcon({ index, step, state, canClick, onClick }: StepIconProps) {
  const Icon = state === 'completed' ? CheckIcon : step.icon;
  /*
    Sharp corners match the house style (Badge / Card / Popover all use
    `rounded-none`). States key off shadcn defaults only: completed
    uses the primary surface, active uses the dark foreground inverse,
    upcoming is an outlined muted square.
  */
  const baseClass = 'flex size-11 shrink-0 items-center justify-center border transition-colors';
  const stateClass = cn(
    state === 'completed' && 'border-primary bg-primary text-primary-foreground',
    state === 'active' && 'border-foreground bg-foreground text-background',
    state === 'upcoming' && 'border-border bg-background text-muted-foreground',
  );
  const content = <Icon className="size-6" aria-hidden="true" strokeWidth={2.25} />;

  if (canClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseClass,
          stateClass,
          'cursor-pointer outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring',
        )}
        aria-label={`Go to step ${index + 1}: ${step.label}`}
      >
        {content}
      </button>
    );
  }

  return <div className={cn(baseClass, stateClass)}>{content}</div>;
}

type StepConnectorProps = {
  state: StepState;
};

function StepConnector({ state }: StepConnectorProps) {
  return (
    <div
      className={cn(
        'h-px flex-1 transition-colors',
        state === 'completed' ? 'bg-primary' : 'bg-border',
      )}
      aria-hidden="true"
    />
  );
}

type StatusBadgeProps = {
  state: StepState;
};

function StatusBadge({ state }: StatusBadgeProps) {
  /*
    Three variants, all on shadcn defaults: completed uses the filled
    primary variant (strongest signal - done), active uses secondary
    (neutral but prominent - "you are here"), pending uses outline
    (lowest visual weight).
  */
  if (state === 'completed') {
    return <Badge variant="default">Completed</Badge>;
  }
  if (state === 'active') {
    return <Badge variant="secondary">In Progress</Badge>;
  }
  return <Badge variant="muted">Pending</Badge>;
}
