'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  AUTH_EVENT,
  getAccessToken,
  getStoredUser,
  StoredUser,
} from '@/lib/auth-storage';

type AuthContextValue = {
  /** false do czasu odczytu localStorage — unikamy flasha „niezalogowany” */
  ready: boolean;
  isAuthenticated: boolean;
  user: StoredUser | null;
  refreshAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const refreshAuth = useCallback(() => {
    const token = getAccessToken();
    setIsAuthenticated(Boolean(token));
    setUser(getStoredUser());
    setReady(true);
  }, []);

  useEffect(() => {
    refreshAuth();

    const onAuth = () => refreshAuth();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nsm_access' || e.key === 'nsm_user' || e.key === 'nsm_refresh' || e.key === null) {
        refreshAuth();
      }
    };

    window.addEventListener(AUTH_EVENT, onAuth);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(AUTH_EVENT, onAuth);
      window.removeEventListener('storage', onStorage);
    };
  }, [refreshAuth]);

  const value = useMemo(
    () => ({ ready, isAuthenticated, user, refreshAuth }),
    [ready, isAuthenticated, user, refreshAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth musi być użyty wewnątrz AuthProvider');
  }
  return ctx;
}
