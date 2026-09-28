import type { ParseKeys } from 'i18next';
import { CheckIcon, CircleIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  PASSWORD_RULES,
  type PasswordOwner,
  type PasswordRule,
  passwordChecks,
} from '@/features/users/lib/password-form';
import { cn } from '@/lib/utils';

const RULE_LABELS: Record<PasswordRule, ParseKeys> = {
  length: 'users.password.rule.length',
  characters: 'users.password.rule.characters',
  number: 'users.password.rule.number',
  names: 'users.password.rule.names',
};

type PasswordRequirementsProps = {
  id: string;
  password: string;
  owner: PasswordOwner;
};

export function PasswordRequirements({ id, password, owner }: PasswordRequirementsProps) {
  const { t } = useTranslation();
  const checks = passwordChecks(password, owner);

  return (
    <ul aria-label={t('users.password.requirements')} className="grid gap-1 text-sm" id={id}>
      {PASSWORD_RULES.map((rule) => {
        const met = checks[rule];
        const Icon = met ? CheckIcon : CircleIcon;
        return (
          <li
            className={cn(
              'flex items-center gap-2',
              met ? 'text-success' : 'text-muted-foreground',
            )}
            key={rule}
          >
            <Icon aria-hidden className={met ? 'size-4 shrink-0' : 'size-3 shrink-0 mx-0.5'} />
            <span>{t(RULE_LABELS[rule])}</span>
            <span className="sr-only">
              {t(met ? 'users.password.rule-met' : 'users.password.rule-unmet')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
