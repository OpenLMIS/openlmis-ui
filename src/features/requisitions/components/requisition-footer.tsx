import { useTranslation } from 'react-i18next';
import { ActionTooltip } from '@/components/action-tooltip';
import { Button } from '@/components/ui/button';
import { WorkspaceFooter } from '@/components/workspace';
import type { requisitionCapabilities } from '@/features/requisitions/lib/capabilities';
import { useOnline } from '@/lib/online';

export type FooterAction =
  | 'sync'
  | 'submit'
  | 'submit-and-authorize'
  | 'authorize'
  | 'skip'
  | 'delete';
export function RequisitionFooter({
  policy,
  pending,
  disabled,
  onAction,
}: {
  policy: Pick<ReturnType<typeof requisitionCapabilities>, 'actions'>;
  pending: boolean;
  disabled: boolean;
  onAction: (action: FooterAction) => void;
}) {
  const { t } = useTranslation();
  const online = useOnline();
  const reason = online ? undefined : t('offline.action-description');
  const button = (action: FooterAction) => {
    const capability = action === 'submit-and-authorize' ? 'submitAndAuthorize' : action;
    if (!policy.actions.includes(capability)) return null;
    return (
      <ActionTooltip key={action} reason={reason}>
        <Button
          size="lg"
          variant={
            action === 'delete'
              ? 'destructive'
              : action === 'sync' || action === 'skip'
                ? 'outline'
                : 'default'
          }
          disabled={pending || disabled || !online}
          focusableWhenDisabled={!!reason}
          aria-description={reason}
          onClick={() => onAction(action)}
        >
          {t(`requisitions.edit.actions.${action}`)}
        </Button>
      </ActionTooltip>
    );
  };
  if (!policy.actions.some((action) => action !== 'print')) return null;
  return (
    <WorkspaceFooter width="wide">
      <div className="flex flex-wrap gap-2">
        {button('delete')}
        {button('skip')}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {button('sync')}
        {button('submit')}
        {button('submit-and-authorize')}
        {button('authorize')}
      </div>
    </WorkspaceFooter>
  );
}
