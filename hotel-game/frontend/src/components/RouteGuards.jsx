import { Navigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

/**
 * Protects routes that require authentication.
 * Redirects to landing page if not authenticated.
 */
export function ProtectedRoute({ children }) {
  const token = useAuthStore((state) => state.token);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/**
 * Redirects authenticated users away from public routes (e.g., login).
 * Always redirects to /dashboard.
 */
export function PublicRoute({ children }) {
  const token = useAuthStore((state) => state.token);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
