import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  approvalsOptions,
  convertCountOptions,
  firstNameOptions,
} from '@/features/home/api/queries';

export function WelcomeTitle({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { data: firstName } = useSuspenseQuery(firstNameOptions(userId));
  return t('home.welcome-name', { name: firstName });
}

type WaitingSummaryProps = {
  canApprove: boolean;
  canConvert: boolean;
};

/** One sentence on what is waiting, from the counts this user's rights let them see. */
export function WaitingSummary({ canApprove, canConvert }: WaitingSummaryProps) {
  const { t } = useTranslation();
  if (canApprove && canConvert) return <ApproveAndConvert />;
  if (canApprove) return <ApproveOnly />;
  if (canConvert) return <ConvertOnly />;
  return t('home.summary.default');
}

function ApproveAndConvert() {
  const { t } = useTranslation();
  const { data: approvals } = useSuspenseQuery(approvalsOptions());
  const { data: convert } = useSuspenseQuery(convertCountOptions());
  return t('home.summary.approve-and-convert', { approve: approvals.total, convert });
}

function ApproveOnly() {
  const { t } = useTranslation();
  const { data: approvals } = useSuspenseQuery(approvalsOptions());
  return t('home.summary.approve', { count: approvals.total });
}

function ConvertOnly() {
  const { t } = useTranslation();
  const { data: convert } = useSuspenseQuery(convertCountOptions());
  return t('home.summary.convert', { count: convert });
}
