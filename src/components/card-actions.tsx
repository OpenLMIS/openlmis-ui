import { EllipsisIcon } from 'lucide-react';
import { type ReactElement, type ReactNode, useRef } from 'react';
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
  onSelect?: (trigger: HTMLButtonElement) => void;
  link?: ReactElement;
  data?: { [key: `data-${string}`]: string | boolean };
};

const MAX_BUTTONS = 3;

export function cardActionCount(actions: number) {
  return Math.min(actions, MAX_BUTTONS);
}

export function CardActions({ label, actions }: { label?: string; actions: CardAction[] }) {
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

function CardActionsMenu({ actions, label }: { actions: CardAction[]; label?: string }) {
  const menu = useMenuOpensDialog();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu onOpenChange={menu.onOpenChange}>
      <DropdownMenuTrigger
        render={<Button aria-label={label} ref={trigger} size="icon-sm" variant="outline" />}
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
  const blocks = Array.from({ length: cardActionCount(count) }, (_, index) => index);
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
