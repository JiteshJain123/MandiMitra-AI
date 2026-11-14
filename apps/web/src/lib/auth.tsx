import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { PublicUser } from '@mandimitra/shared';
import { api, setUnauthorizedHandler, tokenStore } from './api';

interface AuthCtx {
  user: PublicUser | null;
  loading: boolean;
  signIn: (token: string, user: PublicUser) => void;
  signOut: () => Promise<void>;
  setUser: (u: PublicUser) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const hasToken = !!tokenStore.get();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: PublicUser }>('/api/auth/me').then((r) => r.user),
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const clear = useCallback(() => {
    tokenStore.clear();
    qc.clear();
    qc.setQueryData(['me'], null);
  }, [qc]);

  useEffect(() => setUnauthorizedHandler(clear), [clear]);

  const value = useMemo<AuthCtx>(() => ({
    user: me.data ?? null,
    loading: hasToken && me.isPending,
    signIn: (token, user) => { tokenStore.set(token); qc.setQueryData(['me'], user); },
    signOut: async () => { try { await api.post('/api/auth/logout'); } catch { /* token may already be invalid */ } clear(); },
    setUser: (u) => qc.setQueryData(['me'], u),
  }), [me.data, me.isPending, hasToken, qc, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
