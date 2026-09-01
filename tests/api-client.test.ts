import { describe, expect, it, vi } from "vitest";

import { createRequestOptions, parseApiError } from "../lib/api/client";
import { loginAdmin, requireAdminSession } from "../lib/auth/session";

describe("Admin API client & session", () => {
  it("always includes credentials: include in request options", () => {
    const opts = createRequestOptions({ method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(opts.credentials).toBe("include");
    expect(opts.headers).toMatchObject({
      "Content-Type": "application/json",
      Accept: "application/json",
    });
  });

  it("parses API error responses with code and reason", async () => {
    const err = await parseApiError({
      error: { code: "CONFLICT", reason: "BUDGET_NOT_CONFIGURED", message: "Budget is not set" },
    });
    expect(err).toMatchObject({
      code: "CONFLICT",
      reason: "BUDGET_NOT_CONFIGURED",
      message: "활동 단가 또는 예산이 설정되지 않았습니다. 설정 페이지에서 먼저 설정해 주세요.",
    });
  });

  it("rejects non-admin sessions with 403 error", async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: { id: "u-1", email: "user@example.com", name: "일반유저", role: "REQUESTER" },
      }),
    });

    await expect(requireAdminSession(mockFetcher)).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("관리자"),
    });
  });

  it("accepts admin session", async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: { id: "a-1", email: "admin@example.com", name: "관리자", role: "ADMIN" },
      }),
    });

    const session = await requireAdminSession(mockFetcher);
    expect(session.user.role).toBe("ADMIN");
  });

  it("logs in and verifies admin role", async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: { id: "a-1", email: "admin@example.com", name: "관리자", role: "ADMIN" },
      }),
    });

    const user = await loginAdmin("admin@example.com", "password", mockFetcher);
    expect(user.role).toBe("ADMIN");
  });
});
