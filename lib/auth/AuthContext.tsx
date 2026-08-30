"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AdminUser, logoutAdmin, requireAdminSession } from "./session";

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/login";

  const refreshSession = React.useCallback(async () => {
    try {
      const session = await requireAdminSession();
      setUser(session.user);
    } catch {
      setUser(null);
      if (!isLoginPage) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [isLoginPage, router]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const session = await requireAdminSession();
        if (mounted) setUser(session.user);
      } catch {
        if (mounted) {
          setUser(null);
          if (!isLoginPage) {
            router.push("/login");
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    check();
    return () => {
      mounted = false;
    };
  }, [isLoginPage, router]);


  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } finally {
      setUser(null);
      router.push("/login");
    }
  };

  if (loading && !isLoginPage) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-r-transparent"></div>
          <p className="mt-3 text-sm text-gray-500">인증 상태를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout: handleLogout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
