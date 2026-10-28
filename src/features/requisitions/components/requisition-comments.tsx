import { useSuspenseQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { requisitionStatusMessagesOptions } from '@/features/requisitions/api/queries';
import {
  latestRejection,
  RejectionReasonsDialog,
} from '@/features/requisitions/components/rejection-reasons-dialog';
import {
  DraftComment,
  RequisitionCommentDialog,
  useDraftComment,
} from '@/features/requisitions/components/requisition-comment-field';
import { RequisitionHistoryDialog } from '@/features/requisitions/components/requisition-history-dialog';
import { StatusMessage } from '@/features/requisitions/components/status-message';
import type { RequisitionEditor } from '@/features/requisitions/hooks/use-requisition-form';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

export function RequisitionComments({
  record,
  editor,
  pending = false,
  history,
  rejection,
  comment,
  onHistory,
  onRejection,
  onComment = () => {},
  onClose,
}: {
  record: RequisitionRecord;
  editor?: RequisitionEditor;
  pending?: boolean;
  history?: boolean;
  rejection?: boolean;
  comment?: boolean;
  onHistory: () => void;
  onRejection: () => void;
  onComment?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const headingId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const draftComment = useDraftComment(editor);
  const { data } = useSuspenseQuery(requisitionStatusMessagesOptions(record.id));
  const messages = data.toSorted((a, b) => b.createdDate.localeCompare(a.createdDate));
  const latest = messages[0];
  const rejected = latestRejection(record);
  const hasRejections = record.status === 'REJECTED' && !!rejected?.rejectionDtos?.length;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3" ref={sectionRef}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-semibold text-sm" id={headingId}>
          {t('requisitions.requisition.comments')}
        </h2>
        <div className="min-w-8 flex-1">
          <Separator />
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="lg" onClick={onHistory}>
            {t('requisitions.requisition.view-history')}
          </Button>
        )}
        {hasRejections && (
          <Button variant="outline" size="lg" onClick={onRejection}>
            {t('requisitions.requisition.view-rejection')}
          </Button>
        )}
        {editor && !draftComment && (
          <Button
            data-comment-return
            disabled={pending}
            size="lg"
            variant="outline"
            onClick={onComment}
          >
            <PlusIcon data-icon="inline-start" />
            {t('requisitions.edit.add-comment')}
          </Button>
        )}
      </div>
      {editor && draftComment && (
        <DraftComment
          text={draftComment}
          pending={pending}
          onEdit={onComment}
          onRemove={() => {
            editor.form.setFieldValue('draft.draftStatusMessage', '');
            requestAnimationFrame(() =>
              sectionRef.current?.querySelector<HTMLElement>('[data-comment-return]')?.focus(),
            );
          }}
        />
      )}
      {latest ? (
        <StatusMessage message={latest} />
      ) : (
        !draftComment && (
          <p className="rounded-xl border border-dashed px-4 py-3 text-muted-foreground text-sm">
            {t('requisitions.requisition.no-comments')}
          </p>
        )
      )}
      {editor && (
        <RequisitionCommentDialog
          editor={editor}
          open={!!comment}
          pending={pending}
          onClose={onClose}
          finalFocus={() =>
            sectionRef.current?.querySelector<HTMLElement>('[data-comment-return]') ?? true
          }
        />
      )}
      <RequisitionHistoryDialog messages={messages} open={!!history} onClose={onClose} />
      {hasRejections && (
        <RejectionReasonsDialog rejection={rejected} open={!!rejection} onClose={onClose} />
      )}
    </section>
  );
}
