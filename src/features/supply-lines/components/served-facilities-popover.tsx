import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadError } from '@/components/load-error';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { servedFacilitiesOptions } from '@/features/supply-lines/api/queries';
import type { SupplyLine } from '@/features/supply-lines/lib/types';

export function ServedFacilitiesPopover({ line }: { line: SupplyLine }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const suppressFocus = useRef(false);
  const pointerFocus = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const triggerId = useId();
  const node = line.supervisoryNode;
  if (!node?.id || !node.code) return null;
  return (
    <Popover open={open} triggerId={triggerId} onOpenChange={setOpen}>
      <PopoverTrigger
        id={triggerId}
        ref={triggerRef}
        openOnHover
        onPointerDown={() => {
          pointerFocus.current = true;
        }}
        onBlur={() => {
          suppressFocus.current = false;
          pointerFocus.current = false;
        }}
        onFocus={() => {
          if (!suppressFocus.current && !pointerFocus.current) setOpen(true);
          pointerFocus.current = false;
        }}
        render={
          <Button
            size="sm"
            variant="link"
            aria-label={t('supply-lines.served-facilities-for', {
              supplier: line.supplyingFacility?.name ?? '',
              node: node.code,
              program: line.program?.name ?? '',
            })}
          />
        }
      >
        <span dir="ltr">{node.code}</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="inline-start"
        finalFocus={() => {
          suppressFocus.current = true;
          return triggerRef.current;
        }}
      >
        <PopoverTitle>{t('supply-lines.served-facilities')}</PopoverTitle>
        <div className="max-h-64 overflow-y-auto">
          {open && <ServedFacilities nodeId={node.id} />}
        </div>
        <PopoverPrimitive.Close render={<Button variant="outline" size="sm" />}>
          {t('supply-lines.close')}
        </PopoverPrimitive.Close>
      </PopoverContent>
    </Popover>
  );
}

function ServedFacilities({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation();
  const query = useQuery(servedFacilitiesOptions(nodeId));
  if (query.isPending) return <p role="status">{t('supply-lines.membership-loading')}</p>;
  if (query.isError)
    return (
      <LoadError
        error={query.error}
        reset={() => {
          void query.refetch();
        }}
        title={t('supply-lines.membership-error')}
        description={t('supply-lines.membership-error-description')}
      />
    );
  if (query.data.length === 0) return <p>{t('supply-lines.membership-empty')}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {query.data.map((facility, index) => (
        <li className="break-words" dir="auto" key={facility.id ?? index}>
          {facility.name}
        </li>
      ))}
    </ul>
  );
}
