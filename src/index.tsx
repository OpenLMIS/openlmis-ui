import '@/globals.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { ThemeProvider } from 'next-themes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TextDirectionProvider } from '@/components/text-direction';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LEGACY_TOKEN_STORAGE_KEY } from '@/features/auth/lib/legacy-session';
import { syncLegacySession, useLoginData } from '@/features/auth/store/login-data';
import { initI18n } from '@/integrations/i18n';
import { queryClient } from '@/integrations/tanstack-query';
import { router } from '@/integrations/tanstack-router';
import { loadRuntimeConfig } from '@/lib/runtime-config';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

await Promise.all([initI18n(), loadRuntimeConfig()]);

// Before the router guards read the store, so a legacy session lands on /dashboard.
syncLegacySession();

// `storage` fires in the other tabs, so signing out of the legacy UI signs us out too.
window.addEventListener('storage', (event) => {
  if (event.key !== null && event.key !== LEGACY_TOKEN_STORAGE_KEY) return;

  if (syncLegacySession() && !useLoginData.getState().isAuthenticated) {
    router.navigate({ to: '/login' });
  }
});

createRoot(root).render(
  <StrictMode>
    <TextDirectionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </TextDirectionProvider>
  </StrictMode>,
);
