import { useTranslation } from 'react-i18next';

export function LocalizedCount({ count }: { count: number }) {
  const { i18n } = useTranslation();
  return count.toLocaleString(i18n.language);
}
