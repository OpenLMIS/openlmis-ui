import { type ReactNode, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DirectionProvider } from '@/components/ui/direction';
import { getTextDirection } from '@/lib/config';

type TextDirectionProviderProps = {
  children: ReactNode;
};

/**
 * Keeps `<html lang>`/`<html dir>` and every Base UI portal on the active
 * language's direction. Layout effect, so the first frame is never painted LTR.
 */
export function TextDirectionProvider({ children }: TextDirectionProviderProps) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const direction = getTextDirection(language);

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
  }, [language, direction]);

  return <DirectionProvider direction={direction}>{children}</DirectionProvider>;
}
