import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppShellSkeleton from './layout/AppShellSkeleton';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AppShellSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
