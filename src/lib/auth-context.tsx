/**
 * src/lib/auth-context.tsx  (REPLACE the original)
 * Uses the custom backend API instead of Supabase.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { login, register, logout, getMe, type AuthUser } from "./api";

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value: AuthCtx = {
    user,
    loading,
    async signIn(email, password) {
      try {
        const { user } = await login(email, password);
        setUser(user);
        return { error: null };
      } catch (e: any) {
        return { error: e.message };
      }
    },
    async signUp(email, password) {
      try {
        const { user } = await register(email, password);
        setUser(user);
        return { error: null };
      } catch (e: any) {
        return { error: e.message };
      }
    },
    async signOut() {
      logout();
      setUser(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
