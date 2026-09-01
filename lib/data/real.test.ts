import { describe, expect, it, vi, beforeEach } from "vitest";

import * as client from "../api/client";
import { realDataSource } from "./real";

describe("realDataSource adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("maps dashboard endpoints into DashboardData", async () => {
    vi.spyOn(client, "apiFetch").mockImplementation(async (url: string) => {

      if (url.includes("/admin/dashboard/budget")) {
        return {
          month: "2026-08",
          pendingReviewCount: 1,
          activityUnitPrice: 10000,
          estimatedMonthlyActivityCost: 10000,
          overall: {
            totalBudget: 20000000,
            paidWithdrawalAmount: 5000000,
            approvedUnpaidSettlementAmount: 1000000,
            pendingSettlementAmount: 300000,
            usageRate: 0.3,
            remainingBudget: 14000000,
            averageActivityPayment: 10000,
            estimatedRemainingActivityCount: 1400,
          },
          monthly: {
            month: "2026-08",
            monthlyBudget: 3000000,
            approvedSettlementAmount: 1000000,
            pendingSettlementAmount: 200000,
            remainingBudget: 2000000,
            usageRate: 0.4,
          },
        };
      }

      if (url.includes("/admin/dashboard/helpers")) {
        return {
          month: "2026-08",
          activeHelperCount: 5,
          helperPayments: [
            {
              id: "h-1",
              name: "김도움",
              status: "ACTIVE",
              monthlyActivityCount: 10,
              lifetimeActivityCount: 20,
              approvedSettlementAmount: 100000,
              paidWithdrawalAmount: 50000,
              withdrawableBalance: 50000,
            },
          ],
          regions: [
            {
              region: "청도읍",
              recipientCount: 12,
              activeHelperCount: 4,
              assignedHelperCount: 4,
              monthlyActivityCount: 20,
              isUnderstaffed: false,
            },
          ],
        };
      }
      if (url.includes("/admin/dashboard/recipients")) {
        return {
          month: "2026-08",
          recipientCounts: {
            total: 20,
            elderly: 15,
            child: 5,
          },
          monthlyActivity: {
            total: 25,
            submitted: 25,
            approved: 20,
          },
          activityTrend: [{ month: "2026-08", submittedCount: 25, approvedCount: 20 }],
          regions: [],
        };
      }

      if (url.includes("/admin/activity-logs")) {
        return {
          items: [
            {
              id: "l-1",
              createdAt: "2026-08-20T10:00:00Z",
              status: "PENDING_REVIEW",
            },
          ],
        };
      }
      if (url.includes("/admin/requests")) {
        return {
          items: [
            {
              id: "r-1",
              status: "REQUESTED",
              createdAt: "2026-08-25T10:00:00Z",
            },
          ],
        };
      }
      if (url.includes("/admin/helpers")) {
        return {
          items: [
            { id: "h-1", status: "APPLIED" },
            { id: "h-2", status: "EDUCATED" },
          ],
        };
      }
      if (url.includes("/admin/recipients")) {
        return {
          items: [
            { id: "rec-1", region: "화양읍" },
          ],
        };
      }
      if (url.includes("/admin/withdrawals")) {
        return {
          items: [
            { id: "w-1", status: "REQUESTED", requestedAt: "2026-08-28T10:00:00Z" },
          ],
        };
      }
      return {};
    });

    const data = await realDataSource.getDashboard("2026-08");

    expect(data.budget.totalBudget).toBe(20000000);
    expect(data.activeManagerCount).toBe(5);
    expect(data.recipientCount).toBe(20);
    expect(data.actions.pendingLogCount).toBe(1);
    expect(data.actions.appliedManagerCount).toBe(1);
    expect(data.actions.educatedManagerCount).toBe(1);
    expect(data.actions.unassignedRecipientCount).toBe(1);
    expect(data.actions.unassignedByRegion).toEqual([{ region: "화양읍", count: 1 }]);
  });

  it("maps listRecipients correctly", async () => {
    vi.spyOn(client, "apiFetch").mockResolvedValue({
      items: [
        {
          id: "rec-1",
          name: "김햇님",
          type: "CHILD",
          age: 11,
          region: "청도읍",
          address: "경상북도 청도군 청도읍",
          phone: "010-1234-5678",
          careNeeds: "등하교 동행",
          assignedHelper: {
            id: "h-1",
            name: "이도움",
            status: "ACTIVE",
          },
          isArchived: false,
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        },
      ],
      pageInfo: { nextCursor: null, hasMore: false },
    });

    const list = await realDataSource.listRecipients({});
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: "rec-1",
      name: "김햇님",
      type: "CHILD",
      age: 11,
      region: "청도읍",
      addressDetail: "경상북도 청도군 청도읍",
      managerId: "h-1",
      manager: {
        id: "h-1",
        name: "이도움",
        status: "ACTIVE",
      },
    });
  });

  it("calls assign-helper when creating recipient with managerId", async () => {
    const postSpy = vi.spyOn(client, "apiFetch").mockImplementation(async (url: string) => {
      if (url === "/admin/recipients") {
        return { id: "new-rec-id" };
      }
      if (url.includes("/assign-helper")) {
        return {};
      }
      return {};
    });

    const id = await realDataSource.createRecipient({
      name: "새대상자",
      type: "ELDERLY",
      region: "화양읍",
      addressDetail: "화양읍 1번지",
      managerId: "h-123",
    });

    expect(id).toBe("new-rec-id");
    expect(postSpy).toHaveBeenCalledWith("/admin/recipients", expect.anything());
    expect(postSpy).toHaveBeenCalledWith("/admin/recipients/new-rec-id/assign-helper", expect.anything());
  });
});
