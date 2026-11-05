import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Skeleton from './ui/Skeleton';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
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
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default ProtectedRoute;
