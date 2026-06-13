import { useEffect, useState, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../lib/auth-context';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Root() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    // Only redirect ONCE per mount
    if (!loading && !user && !redirectedRef.current) {
      redirectedRef.current = true;
      navigate('/login', { replace: true });
    }

    // Client accounts no longer have access to the system
    if (!loading && user && user.role === 'client' && !redirectedRef.current) {
      redirectedRef.current = true;
      signOut().finally(() => navigate('/login', { replace: true }));
    }
  }, [user, loading, navigate, signOut]);

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden w-full lg:w-auto">
          <Header onMenuClick={() => setIsSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}