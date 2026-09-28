import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function CopyKeyButton({
  token,
  autoFocus = false,
}: {
  token: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      toast.error(t('service-accounts.copy-error-title'), {
        description: t('service-accounts.copy-error'),
      });
    }
  };

  return (
    <Button
      aria-label={t(copied ? 'service-accounts.copied' : 'service-accounts.copy')}
      autoFocus={autoFocus}
      onClick={copy}
      size="icon-xs"
      type="button"
      variant="ghost"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
