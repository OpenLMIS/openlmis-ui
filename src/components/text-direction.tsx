import { type ReactNode, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DirectionProvider } from '@/components/ui/direction';
import { getTextDirection } from '@/lib/config';

type TextDirectionProviderProps = {
  children: ReactNode;
};

// A layout effect, so `<html dir>` is set before the first frame is painted.
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
