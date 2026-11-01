import { Suspense } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from './context/useAuth';
import { useTheme } from './context/useTheme';
import Skeleton from './components/ui/Skeleton';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';

const LoadingSpinner = () => (
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

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" />;

  return children;
};

const LoginRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (user) return <Navigate to="/dashboard" />;

  return <Login />;
};

function App() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <>
      <ToastHost />
      <Suspense fallback={<LoadingSpinner />}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
          >
            <Routes location={location}>
              <Route path="/login" element={<LoginRoute />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id"
                element={
                  <ProtectedRoute>
                    <ProjectDetail />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </>
  );
}

export default App;