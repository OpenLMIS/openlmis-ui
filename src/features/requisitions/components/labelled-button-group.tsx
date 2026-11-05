import { type ReactNode, useId } from 'react';
import { ButtonGroup } from '@/components/ui/button-group';

export function LabelledButtonGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="flex w-full items-center gap-2 @2xl/main:w-auto">
      <span id={id} className="text-sm">
        {label}
      </span>
      <ButtonGroup aria-labelledby={id} width="full">
        {children}
      </ButtonGroup>
    </div>
  );
}
