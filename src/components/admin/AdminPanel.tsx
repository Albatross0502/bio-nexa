import React, { useState, useEffect } from 'react';
import { adminApi, AdminUser } from '../../services/admin/adminApiClient';
import { AdminLoginModal } from './AdminLoginModal';
import { AdminDashboard } from './AdminDashboard';
import { Shield, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminPanel: React.FC = () => {
  const { navigate } = useApp();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const verifyAuth = async () => {
      try {
        const res = await adminApi.checkAuth();
        if (isMounted) {
          if (res.authenticated && res.user) {
            setAdminUser(res.user);
          } else {
            setAdminUser(null);
          }
        }
      } catch {
        if (isMounted) {
          setAdminUser(null);
        }
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    verifyAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await adminApi.logout();
    } catch (e) {
      console.error('Logout error:', e);
    }
    setAdminUser(null);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg animate-pulse">
          <Shield className="w-8 h-8 text-teal-400" />
        </div>
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-mono text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
          <span>Verifying administrator authorization...</span>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return (
      <AdminLoginModal
        onSuccess={(user) => setAdminUser(user)}
        onCancel={() => navigate('/')}
      />
    );
  }

  return <AdminDashboard adminUser={adminUser} onLogout={handleLogout} />;
};
