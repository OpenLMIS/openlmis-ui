import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  approvalsOptions,
  convertCountOptions,
  firstNameOptions,
} from '@/features/home/api/queries';

/** The user's name once it loads; the page's plain title until then or if it cannot. */
export function WelcomeTitle({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { data: firstName } = useQuery(firstNameOptions(userId));
  return firstName ? t('home.welcome-name', { name: firstName }) : t('home.title');
}

type WaitingSummaryProps = {
  canApprove: boolean;
  canConvert: boolean;
};

/** One sentence on what is waiting, from the counts this user's rights let them see. */
export function WaitingSummary({ canApprove, canConvert }: WaitingSummaryProps) {
  const { t } = useTranslation();
  const approvals = useQuery({ ...approvalsOptions(), enabled: canApprove });
  const convert = useQuery({ ...convertCountOptions(), enabled: canConvert });
  const toApprove = approvals.data?.total;
  const toConvert = convert.data;

  if (canApprove && canConvert && toApprove !== undefined && toConvert !== undefined) {
    return t('home.summary.approve-and-convert', { approve: toApprove, convert: toConvert });
  }
  if (canApprove && !canConvert && toApprove !== undefined) {
    return t('home.summary.approve', { count: toApprove });
  }
  if (canConvert && !canApprove && toConvert !== undefined) {
    return t('home.summary.convert', { count: toConvert });
  }
  return canApprove || canConvert ? t('home.description') : t('home.summary.default');
}
