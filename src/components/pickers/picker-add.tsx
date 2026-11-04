import { PlusIcon } from 'lucide-react';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { Button } from '@/components/ui/button';
import { InputGroupAddon } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

export function PickerAdd({
  children,
  align = 'center',
}: {
  children: ReactNode;
  align?: 'center' | 'end';
}) {
  return (
    <div
      className={cn(
        'flex w-full gap-2 @3xl/main:contents',
        align === 'end' ? 'items-end' : 'items-center',
      )}
    >
      {children}
    </div>
  );
}

export function PickerAddField({
  children,
  ref,
}: {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="min-w-0 flex-1 @3xl/main:max-w-96" ref={ref}>
      {children}
    </div>
  );
}

export function PickerAddIcon({ children }: { children: ReactNode }) {
  return <InputGroupAddon align="inline-start">{children}</InputGroupAddon>;
}

export function PickerAddButton({
  children,
  icon = <PlusIcon data-icon="inline-start" />,
  size = 'lg',
  ...props
}: Omit<ComponentProps<typeof Button>, 'className' | 'width' | 'variant' | 'size'> & {
  icon?: ReactNode;
  size?: 'default' | 'lg';
}) {
  return (
    <Button size={size} type="button" {...props}>
      {icon}
      {children}
    </Button>
  );
}
