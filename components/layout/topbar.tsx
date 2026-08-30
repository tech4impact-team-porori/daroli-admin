"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";

export function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold text-gray-700">청도군 돌봄 매니저 양성사업</h1>
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="text-sm text-gray-600">
              <strong className="text-gray-900">{user.name}</strong> 님 (관리자)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="text-gray-600 hover:text-red-600 hover:border-red-200"
            >
              로그아웃
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" className="text-gray-600">
            계정
          </Button>
        )}
      </div>
    </header>
  );
}

