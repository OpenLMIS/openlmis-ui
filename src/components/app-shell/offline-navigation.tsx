import { CircleAlertIcon } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type OfflineNavigation = {
  open: boolean;
  show: (target?: HTMLElement | null) => void;
  descriptionId: string;
};
const OfflineNavigationContext = createContext<OfflineNavigation>({
  open: false,
  show: () => {},
  descriptionId: '',
});
export const useOfflineNavigation = () => useContext(OfflineNavigationContext);

export function OfflineNavigationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { open, show, dialog } = useOfflineNavigationDialog();
  const descriptionId = useId();
  const value = useMemo(() => ({ open, show, descriptionId }), [open, show, descriptionId]);
  return (
    <OfflineNavigationContext value={value}>
      <span id={descriptionId} className="sr-only">
        {t('offline.connection-required')}
      </span>
      {children}
      {dialog}
    </OfflineNavigationContext>
  );
}

export function useOfflineNavigationDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const show = useCallback((target = document.activeElement as HTMLElement | null) => {
    returnFocus.current = target;
    setOpen(true);
  }, []);
  return {
    open,
    show,
    dialog: (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent finalFocus={returnFocus}>
          <AlertDialogHeader>
            <AlertDialogMedia variant="destructive">
              <CircleAlertIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>{t('offline.navigation-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('offline.navigation-unavailable')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  };
}
