import '@/globals.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TextDirectionProvider } from '@/components/text-direction';
import { TooltipProvider } from '@/components/ui/tooltip';
import { syncLegacySession, syncOtherTab } from '@/features/auth/store/login-data';
import { initI18n } from '@/integrations/i18n';
import { queryClient } from '@/integrations/tanstack-query';
import { router } from '@/integrations/tanstack-router';
import { loadAppConfiguration } from '@/lib/app-configuration';
import { startApplyingAppConfiguration } from '@/lib/apply-app-configuration';
import { seedOnline } from '@/lib/online';
import { reportCaughtError } from '@/lib/report-error';
import { loadRuntimeConfig } from '@/lib/runtime-config';
import { registerServiceWorker } from '@/lib/service-worker';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

seedOnline();
const configuration = loadAppConfiguration();
startApplyingAppConfiguration();
await Promise.all([initI18n(), loadRuntimeConfig(), configuration]);

// Before the router guards read the store, so a legacy session lands on /home.
syncLegacySession();

// `storage` fires in the other tabs, so a sign out anywhere, even in the legacy UI, reaches this one.
window.addEventListener('storage', async (event) => {
  if (await syncOtherTab(event.key)) router.navigate({ to: '/login' });
});

registerServiceWorker();

createRoot(root, { onCaughtError: reportCaughtError }).render(
  <StrictMode>
    <TextDirectionProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </TextDirectionProvider>
  </StrictMode>,
);
