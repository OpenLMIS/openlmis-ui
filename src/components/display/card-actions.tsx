import { EllipsisIcon } from 'lucide-react';
import { createContext, type ReactElement, type ReactNode, use, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';

export type CardAction = {
  id: string;
  icon: ReactNode;
  label: string;
  name?: string;
  destructive?: boolean;
  disabled?: boolean;
  focusableWhenDisabled?: boolean;
  onSelect?: (trigger: HTMLButtonElement) => void;
  link?: ReactElement;
  primary?: boolean;
  data?: DataAttributes;
};

type DataAttributes = { [key: `data-${string}`]: string | boolean };

const MAX_BUTTONS = 3;

export const InCardContext = createContext(false);

export function useInCards() {
  return use(InCardContext);
}

export function CardActions({ label, actions }: { label: string; actions: CardAction[] }) {
  const ordered = [
    ...actions.filter((action) => !action.destructive),
    ...actions.filter((action) => action.destructive),
  ];
  const overflow = ordered.length > MAX_BUTTONS;
  const buttons = overflow ? ordered.slice(0, MAX_BUTTONS - 1) : ordered;
  const menu = overflow ? ordered.slice(MAX_BUTTONS - 1) : [];
  if (ordered.length === 0) return null;
  return (
    <fieldset aria-label={label} className="flex shrink-0 items-center gap-1" data-card-actions>
      {menu.length > 0 && <CardActionsMenu actions={menu} label={label} />}
      {buttons.toReversed().map((action) => (
        <CardActionButton action={action} key={action.id} />
      ))}
    </fieldset>
  );
}

function CardActionButton({ action }: { action: CardAction }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            {...action.data}
            aria-label={action.name ?? action.label}
            disabled={action.disabled}
            focusableWhenDisabled={action.focusableWhenDisabled}
            nativeButton={!action.link}
            onClick={action.onSelect && ((event) => action.onSelect?.(event.currentTarget))}
            render={action.link}
            size="icon-sm"
            variant={action.destructive ? 'destructive' : 'outline'}
          />
        }
      >
        {action.icon}
      </TooltipTrigger>
      <TooltipContent>{action.label}</TooltipContent>
    </Tooltip>
  );
}

export function RowActions({
  label,
  actions,
  slots,
  disabled,
  data,
}: {
  label: string;
  actions: CardAction[];
  slots?: number;
  disabled?: boolean;
  data?: DataAttributes;
}) {
  if (useInCards()) return <CardActions actions={actions} label={label} />;
  if (actions.length === 0) return null;
  const primary = actions.find((action) => action.primary);
  if (!primary)
    return (
      <div className="flex justify-end">
        <CardActionsMenu
          actions={actions}
          data={data}
          disabled={disabled}
          label={label}
          variant="ghost"
        />
      </div>
    );
  return (
    <fieldset aria-label={label} className="flex items-center justify-end gap-1">
      <Button
        {...primary.data}
        aria-label={primary.name}
        disabled={disabled || primary.disabled}
        focusableWhenDisabled={primary.focusableWhenDisabled}
        nativeButton={!primary.link}
        onClick={primary.onSelect && ((event) => primary.onSelect?.(event.currentTarget))}
        render={primary.link}
        size="sm"
      >
        {primary.label}
      </Button>
      <SecondaryRowActions
        actions={actions.filter((action) => action !== primary)}
        data={data}
        disabled={disabled}
        label={label}
        slots={slots}
      />
    </fieldset>
  );
}

export function SecondaryRowActions({
  label,
  actions,
  slots = actions.length,
  disabled,
  data,
}: {
  label: string;
  actions: CardAction[];
  slots?: number;
  disabled?: boolean;
  data?: DataAttributes;
}) {
  const ordered = [
    ...actions.filter((action) => !action.destructive),
    ...actions.filter((action) => action.destructive),
  ];
  const menu = ordered.length > slots;
  const shown = menu ? 1 : ordered.length;
  const empty = Array.from({ length: Math.max(slots - shown, 0) }, (_, index) => index);
  return (
    <>
      {menu ? (
        <CardActionsMenu actions={ordered} data={data} disabled={disabled} label={label} />
      ) : (
        ordered.map((action) => (
          <CardActionButton action={disabled ? { ...action, disabled } : action} key={action.id} />
        ))
      )}
      {empty.map((slot) => (
        <div aria-hidden className="size-7 shrink-0" key={slot} />
      ))}
    </>
  );
}

function CardActionsMenu({
  actions,
  label,
  variant = 'outline',
  disabled,
  data,
}: {
  actions: CardAction[];
  label: string;
  variant?: 'outline' | 'ghost';
  disabled?: boolean;
  data?: DataAttributes;
}) {
  const menu = useMenuOpensDialog();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu onOpenChange={menu.onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            {...data}
            aria-label={label}
            disabled={disabled}
            ref={trigger}
            size="icon-sm"
            variant={variant}
          />
        }
      >
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" finalFocus={menu.finalFocus} width="auto">
        {actions.map((action) => (
          <DropdownMenuItem
            aria-label={action.name}
            disabled={action.disabled}
            key={action.id}
            onClick={
              action.onSelect &&
              menu.opensDialog(() => trigger.current && action.onSelect?.(trigger.current))
            }
            render={action.link}
            variant={action.destructive ? 'destructive' : 'default'}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CardActionsSkeleton({ count }: { count: number }) {
  const blocks = Array.from({ length: Math.min(count, MAX_BUTTONS) }, (_, index) => index);
  return (
    <div className="flex shrink-0 gap-1">
      {blocks.map((block) => (
        <div className="size-7" key={block}>
          <Skeleton fill />
        </div>
      ))}
    </div>
  );
}
