import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';

interface PrivateRouteProps {
  children: React.ReactNode;
  requiredRole?: 'Admin' | 'Manager' | 'Employee';
}

/**
 * PrivateRoute — wraps protected pages to enforce authentication.
 * Unauthenticated users are redirected to /login, with their
 * intended destination stored so they can be sent back after login.
 */
export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, requiredRole }) => {
  const { currentUser } = useStore();
  const location = useLocation();

  // Check if there is a token at all (fast check without waiting for API)
  const hasToken = !!localStorage.getItem('access_token');

  if (!hasToken || !currentUser) {
    // Redirect to login, preserving where the user was trying to go
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based access control
  if (requiredRole) {
    const roleHierarchy: Record<string, number> = {
      Employee: 1,
      Manager: 2,
      Admin: 3,
    };
    const userLevel = roleHierarchy[currentUser.role] ?? 0;
    const requiredLevel = roleHierarchy[requiredRole] ?? 0;

    if (userLevel < requiredLevel) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
//
