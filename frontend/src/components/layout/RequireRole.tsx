import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { homePath } from '../../utils/users';
import type { Role } from '../../types/user';

export function RequireRole({ role, children }: {role: Role;children: React.ReactNode;}) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  if (user.emailVerified === false) return <Navigate to="/verify-email" replace />;
  if (user.role !== role) return <Navigate to={homePath(user)} replace />;
  return <>{children}</>;
}

export function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/sign-in" replace />;
  if (user.emailVerified === false) return <Navigate to="/verify-email" replace />;
  return <Navigate to={homePath(user)} replace />;
}