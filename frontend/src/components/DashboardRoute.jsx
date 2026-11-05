import { lazy } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

const Dashboard = lazy(() => import('../pages/Dashboard'));

const DashboardRoute = () => {
  const location = useLocation();
  if (location.hash === '#archived-projects') return <Navigate to="/archived" replace />;
  if (location.hash === '#my-tasks') return <Navigate to="/my-tasks" replace />;
  return <ProtectedRoute><Dashboard /></ProtectedRoute>;
};

export default DashboardRoute;
