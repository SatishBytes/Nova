import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, domMax, LazyMotion, m, useReducedMotion } from 'motion/react';
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useAuth } from './context/useAuth';
import { useTheme } from './context/useTheme';
import Skeleton from './components/ui/Skeleton';
import ProtectedRoute from './components/ProtectedRoute';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import DashboardRoute from './components/DashboardRoute';
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const CheckEmail = lazy(() => import('./pages/CheckEmail'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Terms = lazy(() => import('./pages/Terms'));
const ArchivedProjects = lazy(() => import('./pages/ArchivedProjects'));
const MyTasks = lazy(() => import('./pages/MyTasks'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Landing = lazy(() => import('./pages/Landing'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PageSkeleton = () => (
  <div className="app-page">
    <div className="page-container space-y-5" role="status" aria-label="Loading page">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-5 w-72 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    </div>
  </div>
);

const ToastHost = () => {
  const { theme } = useTheme();
  return <Toaster position="top-right" richColors closeButton theme={theme === 'system' ? 'system' : theme} />;
};

const LoginRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <PageSkeleton />;
  if (user) return <Navigate to="/dashboard" />;

  return <Login />;
};

const HomeRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
};

const OfflinePage = () => (
  <main className="offline-page">
    <div className="offline-card">
      <span className="brand-mark" aria-hidden="true">N</span>
      <h1 className="page-heading mt-4">You’re offline</h1>
      <p className="mt-2 text-sm text-muted">NOVA needs a connection to load your workspace. Your private project data is never cached offline.</p>
      <button type="button" className="ui-button button-primary mt-5" onClick={() => window.location.reload()}>
        Retry connection
      </button>
    </div>
  </main>
);

const NetworkStatus = ({ online }) => (
  online ? null : (
    <div className="offline-indicator" role="status" aria-live="polite">
      You’re offline
    </div>
  )
);

const PwaUpdates = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      setNeedRefresh(true);
    },
  });

  useEffect(() => {
    if (!needRefresh) return undefined;
    const toastId = toast('Update available', {
      description: 'Refresh to use the latest version of NOVA.',
      duration: Infinity,
      action: {
        label: 'Refresh',
        onClick: () => { void updateServiceWorker(true); },
      },
      cancel: {
        label: 'Later',
        onClick: () => setNeedRefresh(false),
      },
    });
    return () => toast.dismiss(toastId);
  }, [needRefresh, updateServiceWorker]);
  return null;
};

function App() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <LazyMotion features={domMax}>
      <>
      <ToastHost />
      <PwaUpdates />
      <NetworkStatus online={online} />
      {!online ? (
        <OfflinePage />
      ) : (
        <Suspense fallback={<PageSkeleton />}>
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={location.pathname}
              initial={reduceMotion ? false : { opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
            >
              <RouteErrorBoundary key={location.pathname}>
                <Routes location={location}>
                  <Route path="/login" element={<LoginRoute />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/check-email" element={<CheckEmail />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/dashboard" element={<DashboardRoute />} />
                  <Route path="/archived" element={<ProtectedRoute><ArchivedProjects /></ProtectedRoute>} />
                  <Route path="/my-tasks" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
                  <Route path="/project/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/offline" element={<OfflinePage />} />
                  <Route path="/" element={<HomeRoute />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </RouteErrorBoundary>
            </m.div>
          </AnimatePresence>
        </Suspense>
      )}
      </>
    </LazyMotion>
  );
}

export default App;