import { useState, useEffect, useCallback } from 'react';
import { api, clearApiCache } from '../lib/api';
import { getUser, setAuth, clearAuth, type User } from '../lib/auth';
import { navigateTo } from '../lib/router';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getUser();
    if (stored) {
      setUser(stored);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api.post('/auth/login', { username, password });
    clearApiCache();
    setAuth(result.token, result.user);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    clearApiCache();
    setUser(null);
    navigateTo('/login', { replace: true });
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    return api.put('/auth/password', { oldPassword, newPassword });
  }, []);

  return { user, loading, login, logout, changePassword };
}
