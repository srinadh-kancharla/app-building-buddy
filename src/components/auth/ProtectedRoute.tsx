import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';

type Role = 'admin' | 'organizer' | 'user';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: Role;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isAdmin, isOrganizer, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-20 text-center text-muted-foreground">Loading…</div>
      </Layout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole === 'admin' && !isAdmin) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="text-3xl font-display tracking-wide mb-2">UNAUTHORIZED</h1>
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </Layout>
    );
  }

  if (requiredRole === 'organizer' && !isOrganizer && !isAdmin) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="text-3xl font-display tracking-wide mb-2">UNAUTHORIZED</h1>
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </Layout>
    );
  }

  return <>{children}</>;
}
