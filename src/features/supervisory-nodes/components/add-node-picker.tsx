import { useSuspenseQuery } from '@tanstack/react-query';
import { NetworkIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadError } from '@/components/load-error';
import { PickerAdd, PickerAddButton, PickerAddField, PickerAddIcon } from '@/components/picker-add';
import { QueryBoundary } from '@/components/query-boundary';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import {
  minimalFacilitiesOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import type { NodeLinkKind } from '@/features/supervisory-nodes/lib/edit-search';
import { facilityNames } from '@/features/supervisory-nodes/lib/facility-names';
import {
  childOptions,
  type DraftNode,
  partnerOptions,
} from '@/features/supervisory-nodes/lib/node-form';

type NodeItem = { value: string; label: string };
const NO_ITEMS: NodeItem[] = [];
const noop = () => {};
type AddNodePickerProps = {
  kind: NodeLinkKind;
  selfId: string;
  rows: DraftNode[];
  parentId: string | null;
  disabled: boolean;
  onAdd: (node: DraftNode) => void;
};

export function AddNodePicker(props: AddNodePickerProps) {
  const { t } = useTranslation();
  return (
    <QueryBoundary
      errorComponent={({ error, reset }) => (
        <LoadError
          error={error}
          reset={reset}
          title={t('supervisory-nodes.form.lookup-error')}
          description={t('error.check-connection')}
        />
      )}
      pendingFallback={<AddNodePickerSkeleton kind={props.kind} />}
      resetKey={`${props.selfId}:${props.kind}`}
    >
      <LoadedNodePicker {...props} />
    </QueryBoundary>
  );
}

export function AddNodePickerSkeleton({ kind }: { kind: NodeLinkKind }) {
  return <NodePickerRow kind={kind} items={NO_ITEMS} disabled onAdd={noop} />;
}

function LoadedNodePicker({ kind, selfId, rows, parentId, disabled, onAdd }: AddNodePickerProps) {
  const { data: nodes } = useSuspenseQuery(supervisoryNodesOptions());
  const { data: facilities } = useSuspenseQuery(minimalFacilitiesOptions());
  const names = facilityNames(facilities);
  const items =
    kind === 'child'
      ? childOptions(nodes, selfId, rows, parentId, names)
      : partnerOptions(nodes, selfId, rows, names);
  return (
    <NodePickerRow
      kind={kind}
      items={items}
      disabled={disabled}
      onAdd={(id) => {
        const node = nodes.find((candidate) => candidate.id === id);
        if (node) {
          onAdd({ id: node.id, name: node.name, code: node.code, facilityId: node.facility?.id });
        }
      }}
    />
  );
}

function NodePickerRow({
  kind,
  items,
  disabled,
  onAdd,
}: {
  kind: NodeLinkKind;
  items: NodeItem[];
  disabled: boolean;
  onAdd: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = items.find(({ value }) => value === pickedId) ?? null;
  const field = useRef<HTMLDivElement>(null);
  const add = () => {
    if (disabled || !picked) return;
    onAdd(picked.value);
    setPickedId(null);
    field.current?.querySelector('input')?.focus();
  };
  return (
    <PickerAdd>
      <Combobox
        items={items}
        itemToStringLabel={(item) => item.label}
        value={picked}
        onValueChange={(item) => setPickedId(item?.value ?? null)}
        disabled={disabled}
      >
        <PickerAddField ref={field}>
          <ComboboxInput
            size="lg"
            aria-label={t(`supervisory-nodes.form.pick-${kind}`)}
            dir="auto"
            placeholder={t(`supervisory-nodes.form.pick-${kind}`)}
            width="full"
          >
            <PickerAddIcon>
              <NetworkIcon />
            </PickerAddIcon>
          </ComboboxInput>
        </PickerAddField>
        <ComboboxContent anchor={field}>
          <ComboboxEmpty>{t('supervisory-nodes.form.no-options')}</ComboboxEmpty>
          <ComboboxList>
            {(item: NodeItem) => (
              <ComboboxItem key={item.value} value={item}>
                <bdi>{item.label}</bdi>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <PickerAddButton disabled={disabled || !picked} onClick={add}>
        {t('supervisory-nodes.form.add')}
      </PickerAddButton>
    </PickerAdd>
  );
}
