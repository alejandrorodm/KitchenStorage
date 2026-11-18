import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { ApiError } from './api/client';
import { keys } from './api/hooks';
import { App } from './app/App';
import { ToastProvider } from './components/atoms/Toast';
import { applyWhenIdle } from './shared/app-update';
import '@fontsource-variable/figtree';
import '@fontsource-variable/bricolage-grotesque';
import './styles.css';

// An expired session anywhere sends the user back to the sign-in screen.
const onError = (error: Error) => {
  if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(keys.me, null);
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

// Time after an action ends during which its confirmation message is still on screen.
const QUIET_MS = 4000;
let lastActivity = 0;
queryClient.getMutationCache().subscribe(() => {
  lastActivity = Date.now();
});
const busy = () => queryClient.isMutating() > 0 || Date.now() - lastActivity < QUIET_MS;

// A new version found in the background installs itself, but only reloads the page once the app is idle.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => applyWhenIdle(() => void updateSW(true), busy),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
