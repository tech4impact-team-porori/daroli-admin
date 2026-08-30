"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { loginAdmin } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await loginAdmin(email, password);
      router.push("/");
    } catch (err: unknown) {
      const apiErr = err as { status?: number; code?: string; message?: string };
      if (apiErr.status === 401 || apiErr.code === "INVALID_CREDENTIALS") {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else if (apiErr.status === 403 || apiErr.code === "FORBIDDEN") {
        setError("관리자 권한이 있는 계정만 로그인할 수 있습니다.");
      } else {
        setError(apiErr.message || "로그인 중 오류가 발생했습니다.");
      }
    } finally {
      setSubmitting(false);
    }

  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-md border-gray-200">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-2 flex items-center justify-center gap-1.5">
            <span className="text-2xl font-bold text-emerald-600">다로리</span>
            <span className="text-sm font-semibold text-gray-500">돌봄 매니저</span>
          </div>
          <CardTitle className="text-xl font-bold text-gray-900">관리자 로그인</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            청도군 돌봄 서비스 관리자 계정으로 접속해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                이메일
              </label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                disabled={submitting}
                className="bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                비밀번호
              </label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={submitting}
                className="bg-white"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 mt-2"
            >
              {submitting ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
