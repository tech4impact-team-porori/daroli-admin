import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { realDataSource } from "../lib/data/real";
import { loginAdmin, requireAdminSession } from "../lib/auth/session";

interface SessionRecord {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    role: "ADMIN" | "HELPER" | "REQUESTER";
    status: "ACTIVE" | "DISABLED";
    helperStatus: string | null;
  };
}

describe("Real API Integration & Admin Workflows", () => {
  let server: {
    inject: (opts: {
      method?: string;
      url: string;
      headers?: Record<string, string>;
      payload?: unknown;
    }) => Promise<{ statusCode: number; headers: Record<string, string | string[]>; payload: string; json: <T = unknown>() => T }>;
    close: () => Promise<void>;

  };

  let adminRepo: {
    createActivityLogDirect: (input: {
      requestId: string;
      helperId: string;
      recipientId: string;
      activityDate: string;
      startTime: string;
      endTime: string;
      careType: string;
      activityType: string;
      content: string;
    }) => Promise<{ id: string }>;
  };

  beforeAll(async () => {
    // Dynamically load backend buildApp & memory repositories for fully isolated E2E testing
    const { buildApp } = await import("../../dolbom-service/apps/api/src/app.js");
    const { MemoryAdminRepository } = await import(
      "../../dolbom-service/apps/api/src/modules/admin/admin-repository.js"
    );

    const authUsers = new Map<string, SessionRecord["user"]>();
    const authSessions = new Map<string, SessionRecord>();

    const adminId = "00000000-0000-4000-8000-000000000001";
    authUsers.set(adminId, {
      id: adminId,
      email: "admin@darori.kr",
      name: "최고관리자",
      passwordHash: "$2b$04$GDZXzXQXSjWUmXGpBEwLRO1fcULSiC9bzXX6nOrXSMWlitjEpntSK",
      role: "ADMIN",
      status: "ACTIVE",
      helperStatus: null,
    });


    const memoryAuth = {
      async findUserByEmail(email: string) {
        return [...authUsers.values()].find((u) => u.email === email) ?? null;
      },
      async createSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
        const user = authUsers.get(input.userId);
        if (!user) throw new Error("User not found");
        const record: SessionRecord = {
          id: `s-${authSessions.size + 1}`,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          revokedAt: null,
          user,
        };
        authSessions.set(record.id, record);
        return { id: record.id };
      },
      async findSessionByTokenHash(tokenHash: string) {
        return [...authSessions.values()].find((s) => s.tokenHash === tokenHash) ?? null;
      },
      async revokeSession(sessionId: string, revokedAt: Date) {
        const s = authSessions.get(sessionId);
        if (s) s.revokedAt = revokedAt;
      },
      async touchSession() {},
    };

    const repoInstance = new MemoryAdminRepository();
    adminRepo = repoInstance;

    const app = await buildApp({
      config: {
        apiPort: 0,
        sessionTtlDays: 14,
        cookieSecure: false,
        webOrigins: ["http://localhost:3000"],
      },
      authRepository: memoryAuth,
      adminRepository: repoInstance,
      logger: false,
    });

    await app.ready();
    server = app;
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  it("authenticates admin and executes complete operational workflow", async () => {
    let cookieHeader = "";
    const customFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const urlStr = typeof url === "string" ? url : url.toString();
      const path = urlStr.replace(/^https?:\/\/[^/]+/, "");
      const injectOpts = {
        method: init?.method || "GET",
        url: path,
        headers: {
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...((init?.headers as Record<string, string>) || {}),
          cookie: cookieHeader,
        },
        payload: init?.body ? JSON.parse(init.body as string) : undefined,
      };


      const res = await server.inject(injectOpts);

      const setCookie = res.headers["set-cookie"];
      if (setCookie) {
        cookieHeader = (Array.isArray(setCookie) ? setCookie[0] : setCookie)!.split(";")[0]!;
      }

      return {
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
        headers: {
          get(name: string) {
            return (res.headers[name.toLowerCase()] as string) || null;
          },
        },
        json: async () => res.json(),
        text: async () => res.payload,
      } as unknown as Response;
    };

    const user = await loginAdmin("admin@darori.kr", "admin1234!", customFetch);
    expect(user.role).toBe("ADMIN");

    const session = await requireAdminSession(customFetch);
    expect(session.user.name).toBe("최고관리자");

    // Patch global fetch for realDataSource
    const originalFetch = globalThis.fetch;
    globalThis.fetch = customFetch as unknown as typeof fetch;

    try {
      // 2. Settings check & update
      const initialSettings = await realDataSource.getSettings();
      expect(initialSettings.unitPrice).toBe(10000);

      await realDataSource.updateSettings({
        unitPrice: 12000,
        totalBudget: 30000000,
        monthlyBudget: 5000000,
      });

      const updatedSettings = await realDataSource.getSettings();
      expect(updatedSettings.unitPrice).toBe(12000);
      expect(updatedSettings.totalBudget).toBe(30000000);

      // 3. Create helper & progress status
      const helperListBefore = await realDataSource.listManagers({});
      expect(helperListBefore).toHaveLength(0);

      // Direct post helper via apiFetch
      const { apiFetch } = await import("../lib/api/client");
      const createdHelper = await apiFetch<{ id: string; status: string }>("/admin/helpers", {
        method: "POST",
        body: JSON.stringify({
          name: "박매니저",
          phone: "010-8888-9999",
          residenceRegion: "청도읍",
          serviceRegions: ["청도읍"],
          hasVehicle: true,
        }),
      });
      expect(createdHelper.id).toBeTruthy();
      expect(createdHelper.status).toBe("APPLIED");

      await realDataSource.updateManagerStatus(createdHelper.id, "EDUCATED");
      const educatedHelper = await realDataSource.getManager(createdHelper.id);
      expect(educatedHelper?.status).toBe("EDUCATED");

      await realDataSource.updateManagerStatus(createdHelper.id, "ACTIVE");
      const activeHelper = await realDataSource.getManager(createdHelper.id);
      expect(activeHelper?.status).toBe("ACTIVE");

      // 4. Create recipient and assign helper
      const recId = await realDataSource.createRecipient({
        name: "김햇님",
        type: "CHILD",
        age: 10,
        region: "청도읍",
        addressDetail: "청도읍 중앙로 12",
        phone: "010-1111-2222",
        careNeeds: "등하교 지원",
        managerId: createdHelper.id,
      });
      expect(recId).toBeTruthy();

      const recList = await realDataSource.listRecipients({});
      expect(recList).toHaveLength(1);
      expect(recList[0]!.name).toBe("김햇님");
      expect(recList[0]!.age).toBe(10);
      expect(recList[0]!.managerId).toBe(createdHelper.id);

      // 5. Help request creation
      const createdReq = await apiFetch<{ id: string }>(`/admin/recipients/${recId}/requests`, {
        method: "POST",
        body: JSON.stringify({
          careType: "PICKUP",
          requestedFor: "2026-08-20T08:30:00Z",
          exactTimeRequired: true,
          notes: "정문 앞 픽업",
        }),
      });
      expect(createdReq.id).toBeTruthy();

      const reqList = await realDataSource.listRequests({});
      expect(reqList).toHaveLength(1);
      expect(reqList[0]!.requestType).toBe("PICKUP");

      // 6. Direct create activity log & approve via realDataSource
      const log = await adminRepo.createActivityLogDirect({
        requestId: createdReq.id,
        helperId: createdHelper.id,
        recipientId: recId,
        activityDate: "2026-08-20",
        startTime: "2026-08-20T08:30:00Z",
        endTime: "2026-08-20T09:30:00Z",
        careType: "PICKUP",
        activityType: "PICKUP",
        content: "등교 동행 완료",
      });

      const logListBefore = await realDataSource.listLogs({ status: "PENDING" });
      expect(logListBefore).toHaveLength(1);

      await realDataSource.approveLog(log.id);

      const logListAfter = await realDataSource.listLogs({ status: "APPROVED" });
      expect(logListAfter).toHaveLength(1);
      expect(logListAfter[0]!.status).toBe("APPROVED");

      // 7. Calculate and approve settlement
      await realDataSource.generateSettlements("2026-08");
      const settlements = await realDataSource.listSettlements("2026-08");
      expect(settlements).toHaveLength(1);
      expect(settlements[0]!.amount).toBe(12000); // 1 activity * 12000 unitPrice

      await realDataSource.approveSettlement(settlements[0]!.id);
      const settlementsAfter = await realDataSource.listSettlements("2026-08");
      expect(settlementsAfter[0]!.status).toBe("APPROVED");

      // 8. Dashboard query
      const dashboard = await realDataSource.getDashboard("2026-08");
      expect(dashboard.budget.totalBudget).toBe(30000000);
      expect(dashboard.monthlyBudget.assigned).toBe(5000000);
      expect(dashboard.recipientCount).toBe(1);
      expect(dashboard.childCount).toBe(1);
      expect(dashboard.elderCount).toBe(0);
      expect(dashboard.activeManagerCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
