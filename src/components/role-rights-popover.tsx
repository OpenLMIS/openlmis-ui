import { useQuery } from '@tanstack/react-query';
import { CheckIcon, CircleHelpIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { rolesOptions } from '@/features/reference-data/api/queries';
import { useRightLabel } from '@/features/reference-data/lib/use-right-label';

type RoleRightsPopoverProps = {
  roleId: string;
  name: string;
};

/** The role's name with a button beside it that shows what the role lets its holder do. */
export function RoleRightsPopover({ roleId, name }: RoleRightsPopoverProps) {
  const { t } = useTranslation();

  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="truncate">{name}</span>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              aria-label={t('role-rights.title', { role: name })}
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <CircleHelpIcon />
        </PopoverTrigger>
        <PopoverContent align="start">
          <RoleRights name={name} roleId={roleId} />
        </PopoverContent>
      </Popover>
    </span>
  );
}

/** Rendered only while the popover is open, so a table of roles does no work for closed ones. */
function RoleRights({ roleId, name }: RoleRightsPopoverProps) {
  const { t } = useTranslation();
  const rightLabel = useRightLabel();
  const { data: roles } = useQuery(rolesOptions());
  const role = roles?.find((item) => item.id === roleId);
  const rights = (role?.rights ?? []).map((right) => rightLabel(right.name)).sort();

  return (
    <>
      <PopoverHeader>
        <PopoverTitle>{t('role-rights.title', { role: name })}</PopoverTitle>
        <PopoverDescription>
          {role?.description || t('role-rights.description', { count: rights.length })}
        </PopoverDescription>
      </PopoverHeader>
      {rights.length > 0 && (
        <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {rights.map((right) => (
            <li className="flex items-center gap-2" key={right}>
              <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-success" />
              {right}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
