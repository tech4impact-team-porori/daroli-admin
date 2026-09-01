import { apiFetch } from "../api/client";
import type {
  ActivityLogCard,
  ActivityType,
  CareRequestRow,
  DashboardData,
  LogFilter,
  LogStatus,
  Manager,
  ManagerFilter,
  ManagerWithStats,
  ManagerStatus,
  PayoutRow,
  Recipient,
  RecipientFilter,
  RecipientWithManager,
  Region,
  RegionStat,
  RequestFilter,
  SettlementRow,
  Settings,
  YearMonth,
} from "../types";
import type { PayoutStatus } from "../status";
import type { DataSource } from "./index";


interface ApiBudgetDashboard {
  month: string;
  pendingReviewCount: number;
  activityUnitPrice: number | null;
  estimatedMonthlyActivityCost: number | null;
  overall: {
    totalBudget: number | null;
    paidWithdrawalAmount: number;
    approvedUnpaidSettlementAmount: number;
    pendingSettlementAmount: number;
    usageRate: number | null;
    remainingBudget: number | null;
    averageActivityPayment: number | null;
    estimatedRemainingActivityCount: number | null;
  };
  monthly: {
    monthlyBudget: number | null;
    approvedSettlementAmount: number;
    pendingSettlementAmount: number;
    remainingBudget: number | null;
    usageRate: number | null;
  };
}


interface ApiHelpersDashboard {

  month: string;
  activeHelperCount: number;
  helperPayments: ApiHelperItem[];
  regions: {
    region: string;
    activeHelperCount: number;
    assignedHelperCount: number;
    recipientCount: number;
    monthlyActivityCount: number;
    isUnderstaffed: boolean;
  }[];
}

interface ApiRecipientsDashboard {
  month: string;
  recipientCounts: {
    total: number;
    elderly: number;
    child: number;
  };
  monthlyActivity: {
    total: number;
    submitted: number;
    approved: number;
  };
  activityTrend: {
    month: string;
    submittedCount: number;
    approvedCount: number;
  }[];
  regions: {
    region: string;
    recipientCount: number;
    monthlyActivityCount: number;
    activeHelperCount: number;
    isUnderstaffed: boolean;
  }[];
}


interface ApiActivityLogItem {
  id: string;
  requestId?: string;
  helperId: string;
  helper: { id: string; name: string };
  recipientId: string;
  recipient: { id: string; name: string; type: "CHILD" | "ELDERLY"; region: string };
  activityDate: string;
  startTime: string;
  endTime: string;
  activityType: "GENERAL" | "PICKUP" | "COMMUNITY" | "EMERGENCY" | "OTHER";
  place?: string;
  participantCount?: number;
  content: string;
  note?: string | null;
  gpsStart?: { lat: number; lng: number; at: string } | null;
  gpsEnd?: { lat: number; lng: number; at: string } | null;
  gpsDistance?: number | null;
  isManual: boolean;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  photos?: { id: string; url: string }[];
  createdAt: string;
}

interface ApiRequestItem {
  id: string;
  careType: "HOSPITAL_RIDE" | "COMPANIONSHIP" | "HOME_HELP" | "MEAL_SUPPORT" | "OTHER";
  requestedFor: string;
  exactTimeRequired: boolean;
  status: "REQUESTED" | "PROPOSED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  recipient: { id: string; name: string; region: string };
  helper?: { id: string; name: string } | null;
  createdAt: string;
}

interface ApiHelperItem {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  status: "APPLIED" | "EDUCATED" | "ACTIVE" | "INACTIVE";
  residenceRegion: string;
  serviceRegions: string[];
  hasVehicle: boolean;
  assignedRecipientCount: number;
  monthlyActivityCount: number;
  lifetimeActivityCount: number;
  approvedSettlementAmount: number;
  paidWithdrawalAmount: number;
  withdrawableBalance: number;
  educationCompletedAt?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
}

interface ApiRecipientItem {
  id: string;
  name: string;
  type: "CHILD" | "ELDERLY";
  age?: number | null;
  region: string;
  address: string;
  phone?: string | null;
  careNeeds?: string | null;
  isArchived: boolean;
  archivedAt?: string | null;
  assignedHelper?: { id: string; name: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiSettlementItem {
  id: string;
  helper: { id: string; name: string };
  month: string;
  activityCount: number;
  unitPrice: number;
  amount: number;
  status: "PENDING" | "APPROVED" | "PAID" | "CANCELLED";
  reviewedByUserId?: string | null;
  approvedAt?: string | null;
  createdAt: string;
}


interface ApiWithdrawalItem {
  id: string;
  helperId: string;
  helper: { id: string; name: string };
  amount: number;
  status: "REQUESTED" | "PAID" | "REJECTED";
  rejectionReason?: string | null;
  reviewedByUserId?: string | null;
  requestedAt?: string;
  paidAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
}

interface ApiSettings {
  activityUnitPrice: number;
  totalBudget: number;
  monthlyBudget: number;
  updatedAt: string;
}

function daysBetween(fromIso: string, toIso: string): number {
  const diffMs = Math.abs(new Date(toIso).getTime() - new Date(fromIso).getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export const realDataSource: DataSource = {
  async getDashboard(yearMonth: YearMonth): Promise<DashboardData> {
    const [
      budgetRes,
      helpersRes,
      recipientsRes,
      pendingLogsRes,
      requestsRes,
      allHelpersRes,
      unassignedRecipientsRes,
      withdrawalsRes,
    ] = await Promise.all([
      apiFetch<ApiBudgetDashboard>(`/admin/dashboard/budget?month=${yearMonth}`),
      apiFetch<ApiHelpersDashboard>(`/admin/dashboard/helpers?month=${yearMonth}`),
      apiFetch<ApiRecipientsDashboard>(`/admin/dashboard/recipients?month=${yearMonth}`),
      apiFetch<{ items: ApiActivityLogItem[] }>(`/admin/activity-logs?status=PENDING_REVIEW&limit=50`),
      apiFetch<{ items: ApiRequestItem[] }>(`/admin/requests?status=REQUESTED&limit=50`),
      apiFetch<{ items: ApiHelperItem[] }>(`/admin/helpers?limit=50`),
      apiFetch<{ items: ApiRecipientItem[] }>(`/admin/recipients?unassignedOnly=true&limit=50`),
      apiFetch<{ items: ApiWithdrawalItem[] }>(`/admin/withdrawals?status=REQUESTED&limit=50`),

    ]);

    const nowIso = new Date().toISOString();
    const pendingLogs = pendingLogsRes?.items || [];
    const requestedWithdrawals = withdrawalsRes?.items || [];
    const requestedRequests = requestsRes?.items || [];
    const helpers = allHelpersRes?.items || [];
    const unassignedRecipients = unassignedRecipientsRes?.items || [];

    let oldestLogDays = 0;
    if (pendingLogs.length > 0) {
      const sortedLogs = [...pendingLogs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      oldestLogDays = daysBetween(sortedLogs[0].createdAt, nowIso);
    }

    let oldestPayoutDays = 0;
    if (requestedWithdrawals.length > 0) {
      const sortedPayouts = [...requestedWithdrawals].sort(
        (a, b) =>
          new Date(a.requestedAt || a.createdAt).getTime() -
          new Date(b.requestedAt || b.createdAt).getTime(),
      );
      oldestPayoutDays = daysBetween(
        sortedPayouts[0].requestedAt || sortedPayouts[0].createdAt,
        nowIso,
      );
    }

    const staleReqs = requestedRequests.filter(
      (r) => (new Date(nowIso).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60) >= 24,
    );

    const appliedCount = helpers.filter((h) => h.status === "APPLIED").length;
    const educatedCount = helpers.filter((h) => h.status === "EDUCATED").length;

    const unassignedMap = new Map<Region, number>();
    for (const r of unassignedRecipients) {
      const region = r.region as Region;
      unassignedMap.set(region, (unassignedMap.get(region) || 0) + 1);
    }
    const unassignedByRegion = [...unassignedMap.entries()]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);

    const regions: RegionStat[] = (helpersRes?.regions || []).map((r) => ({
      region: r.region as Region,
      recipientCount: r.recipientCount,
      activeManagerCount: r.activeHelperCount,
      assignedManagerCount: r.assignedHelperCount,
      monthlyLogCount: r.monthlyActivityCount,
      isShortage: r.isUnderstaffed,
    }));

    const shortageRegs = regions.filter((r) => r.isShortage).map((r) => r.region);

    const managerPayments = (helpersRes?.helperPayments || []).map((p) => ({
      managerId: p.id,
      managerName: p.name,
      isRetired: p.status === "INACTIVE",
      monthlyLogCount: p.monthlyActivityCount ?? 0,
      approvedTotal: p.approvedSettlementAmount ?? 0,
      paidTotal: p.paidWithdrawalAmount ?? 0,
      balance: p.withdrawableBalance ?? 0,
    }));

    return {
      pendingLogCount: pendingLogs.length,
      budget: {
        totalBudget: budgetRes.overall.totalBudget || 0,
        paidTotal: budgetRes.overall.paidWithdrawalAmount || 0,
        approvedUnpaid: budgetRes.overall.approvedUnpaidSettlementAmount || 0,
        pendingEstimate: budgetRes.overall.pendingSettlementAmount || 0,
        usageRate: budgetRes.overall.usageRate || 0,
        remaining: budgetRes.overall.remainingBudget || 0,
        averagePerActivity: budgetRes.overall.averageActivityPayment || 0,
        possibleActivities: budgetRes.overall.estimatedRemainingActivityCount || 0,
      },
      monthlyBudget: {
        yearMonth,
        assigned: budgetRes.monthly.monthlyBudget || 0,
        approved: budgetRes.monthly.approvedSettlementAmount || 0,
        calculating: budgetRes.monthly.pendingSettlementAmount || 0,
        remaining: budgetRes.monthly.remainingBudget || 0,
        estimated: (budgetRes.monthly.approvedSettlementAmount || 0) + (budgetRes.monthly.pendingSettlementAmount || 0),
      },
      activeManagerCount: helpersRes.activeHelperCount,
      managerPayments,
      recipientCount: recipientsRes.recipientCounts?.total ?? 0,
      elderCount: recipientsRes.recipientCounts?.elderly ?? 0,
      childCount: recipientsRes.recipientCounts?.child ?? 0,
      monthlyLogTotal: recipientsRes.monthlyActivity?.total ?? 0,
      trend: (recipientsRes.activityTrend || []).map((t) => ({
        yearMonth: t.month,
        submitted: t.submittedCount,
        approved: t.approvedCount,
      })),
      regions,
      actions: {
        approvedUnpaid: budgetRes.overall.approvedUnpaidSettlementAmount || 0,
        requestedPayoutCount: requestedWithdrawals.length,
        pendingLogCount: pendingLogs.length,
        oldestPendingDays: oldestLogDays,
        staleRequestCount: staleReqs.length,
        pendingManagerCount: appliedCount + educatedCount,
        unassignedRecipientCount: unassignedRecipients.length,
        shortageRegions: shortageRegs,
        needsBudgetSetup: (budgetRes.monthly.monthlyBudget || 0) === 0,
        unpaidManagerCount: managerPayments.filter((p) => p.balance > 0).length,
        oldestRequestedPayoutDays: oldestPayoutDays,
        appliedManagerCount: appliedCount,
        educatedManagerCount: educatedCount,
        unassignedByRegion,
        budgetSetupMonth: yearMonth,
      },
    };

  },

  async getRegionStats(yearMonth: YearMonth): Promise<RegionStat[]> {
    const res = await apiFetch<ApiHelpersDashboard>(`/admin/dashboard/helpers?month=${yearMonth}`);
    return (res?.regions || []).map((r) => ({
      region: r.region as Region,
      recipientCount: r.recipientCount,
      activeManagerCount: r.activeHelperCount,
      assignedManagerCount: r.assignedHelperCount,
      monthlyLogCount: r.monthlyActivityCount,
      isShortage: r.isUnderstaffed,
    }));
  },


  async listLogs(filter: LogFilter): Promise<ActivityLogCard[]> {
    const params = new URLSearchParams();
    if (filter.yearMonth) params.set("month", filter.yearMonth);
    if (filter.status) {
      const statusMap: Record<string, string> = {
        PENDING: "PENDING_REVIEW",
        APPROVED: "APPROVED",
        REJECTED: "REJECTED",
      };
      params.set("status", statusMap[filter.status] || filter.status);
    }
    if (filter.managerId) params.set("helperId", filter.managerId);
    params.set("limit", "50");

    const res = await apiFetch<{ items: ApiActivityLogItem[] }>(`/admin/activity-logs?${params.toString()}`);
    return (res?.items || []).map((l) => ({
      id: l.id,
      requestId: l.requestId,
      managerId: l.helperId,
      managerName: l.helper?.name || "알 수 없음",
      recipientId: l.recipientId,
      recipientName: l.recipient?.name || "알 수 없음",
      recipientType: l.recipient?.type || "ELDERLY",
      region: (l.recipient?.region || "청도읍") as Region,
      activityDate: l.activityDate,
      startedAt: l.startTime,
      endedAt: l.endTime,
      activityType: (l.activityType === "EMERGENCY" ? "URGENT" : l.activityType) as ActivityType,
      place: l.place || "",

      participantCount: l.participantCount || 1,
      content: l.content,
      note: l.note || undefined,
      gpsStart: l.gpsStart ? { lat: l.gpsStart.lat, lng: l.gpsStart.lng, at: l.gpsStart.at } : undefined,
      gpsEnd: l.gpsEnd ? { lat: l.gpsEnd.lat, lng: l.gpsEnd.lng, at: l.gpsEnd.at } : undefined,
      gpsDistance: l.gpsDistance ?? undefined,
      isManual: l.isManual ?? false,
      status: (l.status === "APPROVED" ? "APPROVED" : l.status === "REJECTED" ? "REJECTED" : "PENDING") as LogStatus,
      rejectReason: l.rejectionReason || undefined,

      reviewedBy: l.reviewedByUserId || undefined,
      reviewedAt: l.reviewedAt || undefined,
      photos: l.photos || [],
      createdAt: l.createdAt,
    }));
  },

  async approveLog(id: string): Promise<void> {
    await apiFetch(`/admin/activity-logs/${id}/approve`, { method: "POST" });
  },

  async rejectLog(id: string, reason: string): Promise<void> {
    await apiFetch(`/admin/activity-logs/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  async generateSettlements(yearMonth: YearMonth): Promise<void> {
    await apiFetch(`/admin/settlements/calculate`, {
      method: "POST",
      body: JSON.stringify({ month: yearMonth }),
    });
  },

  async listSettlements(yearMonth: YearMonth): Promise<SettlementRow[]> {
    const res = await apiFetch<{ items: ApiSettlementItem[] }>(`/admin/settlements?month=${yearMonth}&limit=50`);

    return (res?.items || []).map((s) => ({
      id: s.id,
      managerId: s.helper.id,
      managerName: s.helper.name || "알 수 없음",
      yearMonth: s.month,
      logCount: s.activityCount,
      unitPrice: s.unitPrice,
      amount: s.amount,
      status: s.status === "PENDING" ? "CALCULATED" : "APPROVED",
      approvedBy: s.reviewedByUserId || undefined,


      approvedAt: s.approvedAt || undefined,
      createdAt: s.createdAt,
    }));
  },

  async approveSettlement(id: string): Promise<void> {
    await apiFetch(`/admin/settlements/${id}/approve`, { method: "POST" });
  },

  async cancelSettlementApproval(id: string): Promise<void> {
    await apiFetch(`/admin/settlements/${id}/cancel`, { method: "POST" });
  },

  async listPayouts(status?: PayoutStatus): Promise<PayoutRow[]> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("limit", "50");

    const res = await apiFetch<{ items: ApiWithdrawalItem[] }>(`/admin/withdrawals?${params.toString()}`);
    return (res?.items || []).map((w) => ({
      id: w.id,
      managerId: w.helperId,
      managerName: w.helper?.name || "알 수 없음",
      amount: w.amount,
      status: w.status,
      rejectReason: w.rejectionReason || undefined,
      processedBy: w.reviewedByUserId || undefined,
      processedAt: (w.paidAt || w.rejectedAt) || undefined,
      createdAt: w.requestedAt || w.createdAt,
    }));
  },

  async markPayoutPaid(id: string): Promise<void> {
    await apiFetch(`/admin/withdrawals/${id}/mark-paid`, { method: "POST" });
  },

  async rejectPayout(id: string, reason: string): Promise<void> {
    await apiFetch(`/admin/withdrawals/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  async listManagers(filter: ManagerFilter): Promise<ManagerWithStats[]> {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.region) params.set("region", filter.region);
    if (filter.keyword) params.set("search", filter.keyword);
    params.set("limit", "50");

    const res = await apiFetch<{ items: ApiHelperItem[] }>(`/admin/helpers?${params.toString()}`);
    return (res?.items || []).map((h) => ({
      id: h.id,
      name: h.name,
      email: h.email || "",
      phone: h.phone,
      homeRegion: h.residenceRegion as Region,
      activityRegions: h.serviceRegions as Region[],
      hasCar: h.hasVehicle,
      status: h.status as ManagerStatus,
      createdAt: h.createdAt || h.approvedAt || new Date().toISOString(),
      recipientCount: h.assignedRecipientCount ?? 0,
      monthlyLogCount: h.monthlyActivityCount ?? 0,
      totalLogCount: h.lifetimeActivityCount ?? 0,
      approvedTotal: h.approvedSettlementAmount ?? 0,
      paidTotal: h.paidWithdrawalAmount ?? 0,
      balance: h.withdrawableBalance ?? 0,
    }));
  },

  async getManager(id: string): Promise<ManagerWithStats | null> {
    try {
      const h = await apiFetch<ApiHelperItem>(`/admin/helpers/${id}`);
      return {
        id: h.id,
        name: h.name,
        email: h.email || "",
        phone: h.phone,
        homeRegion: h.residenceRegion as Region,
        activityRegions: h.serviceRegions as Region[],
        hasCar: h.hasVehicle,
        status: h.status as ManagerStatus,
        createdAt: h.createdAt || h.approvedAt || new Date().toISOString(),
        recipientCount: h.assignedRecipientCount ?? 0,
        monthlyLogCount: h.monthlyActivityCount ?? 0,
        totalLogCount: h.lifetimeActivityCount ?? 0,
        approvedTotal: h.approvedSettlementAmount ?? 0,
        paidTotal: h.paidWithdrawalAmount ?? 0,
        balance: h.withdrawableBalance ?? 0,
      };
    } catch (e: unknown) {
      const apiErr = e as { status?: number };
      if (apiErr.status === 404) return null;
      throw e;
    }
  },

  async updateManagerStatus(id: string, status: ManagerStatus): Promise<void> {
    if (status === "EDUCATED") {
      await apiFetch(`/admin/helpers/${id}/complete-education`, { method: "POST" });
    } else if (status === "ACTIVE") {
      await apiFetch(`/admin/helpers/${id}/activate`, { method: "POST" });
    } else if (status === "INACTIVE") {
      await apiFetch(`/admin/helpers/${id}/deactivate`, { method: "POST" });
    } else {
      await apiFetch(`/admin/helpers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    }
  },

  async updateManager(id: string, patch: Partial<Manager>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.phone !== undefined) payload.phone = patch.phone;
    if (patch.email !== undefined) payload.email = patch.email;
    if (patch.homeRegion !== undefined) payload.residenceRegion = patch.homeRegion;
    if (patch.activityRegions !== undefined) payload.serviceRegions = patch.activityRegions;
    if (patch.hasCar !== undefined) payload.hasVehicle = patch.hasCar;

    await apiFetch(`/admin/helpers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async listRecipients(filter: RecipientFilter): Promise<RecipientWithManager[]> {
    const params = new URLSearchParams();
    if (filter.type) params.set("type", filter.type);
    if (filter.region) params.set("region", filter.region);
    if (filter.unassignedOnly) params.set("unassignedOnly", "true");
    if (filter.keyword) params.set("search", filter.keyword);
    params.set("limit", "50");

    const res = await apiFetch<{ items: ApiRecipientItem[] }>(`/admin/recipients?${params.toString()}`);
    return (res?.items || []).map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      age: r.age ?? undefined,
      region: r.region as Region,
      addressDetail: r.address,
      phone: r.phone || undefined,
      careNeeds: r.careNeeds || undefined,
      managerId: r.assignedHelper?.id || undefined,
      createdAt: r.createdAt,
      deletedAt: r.isArchived ? (r.archivedAt || r.updatedAt) : undefined,
      manager: r.assignedHelper
        ? {
            id: r.assignedHelper.id,
            name: r.assignedHelper.name,
            status: r.assignedHelper.status as ManagerStatus,
          }
        : undefined,
    }));
  },

  async createRecipient(input: Omit<Recipient, "id" | "createdAt">): Promise<string> {
    const res = await apiFetch<{ id: string }>(`/admin/recipients`, {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        type: input.type,
        age: input.age,
        region: input.region,
        address: input.addressDetail,
        phone: input.phone,
        careNeeds: input.careNeeds,
      }),
    });

    if (input.managerId) {
      await apiFetch(`/admin/recipients/${res.id}/assign-helper`, {
        method: "POST",
        body: JSON.stringify({ helperId: input.managerId }),
      });
    }

    return res.id;
  },

  async updateRecipient(id: string, patch: Partial<Recipient>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.type !== undefined) payload.type = patch.type;
    if (patch.age !== undefined) payload.age = patch.age;
    if (patch.region !== undefined) payload.region = patch.region;
    if (patch.addressDetail !== undefined) payload.address = patch.addressDetail;
    if (patch.phone !== undefined) payload.phone = patch.phone;
    if (patch.careNeeds !== undefined) payload.careNeeds = patch.careNeeds;

    if (Object.keys(payload).length > 0) {
      await apiFetch(`/admin/recipients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    }

    if (patch.managerId !== undefined) {
      const current = await apiFetch<ApiRecipientItem>(`/admin/recipients/${id}`);
      const currentHelperId = current.assignedHelper?.id;

      if (patch.managerId !== currentHelperId) {
        if (currentHelperId) {
          await apiFetch(`/admin/recipients/${id}/unassign-helper`, {
            method: "POST",
            body: JSON.stringify({}),
          });
        }
        if (patch.managerId) {
          await apiFetch(`/admin/recipients/${id}/assign-helper`, {
            method: "POST",
            body: JSON.stringify({ helperId: patch.managerId }),
          });
        }
      }
    }
  },

  async deleteRecipient(id: string): Promise<void> {
    await apiFetch(`/admin/recipients/${id}/archive`, { method: "POST" });
  },

  async listRequests(filter: RequestFilter): Promise<CareRequestRow[]> {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.keyword) params.set("search", filter.keyword);
    params.set("limit", "50");

    const res = await apiFetch<{ items: ApiRequestItem[] }>(`/admin/requests?${params.toString()}`);
    return (res?.items || []).map((req) => ({
      id: req.id,
      recipientId: req.recipient?.id || "",
      recipientName: req.recipient?.name || "알 수 없음",
      managerId: req.helper?.id || undefined,
      managerName: req.helper?.name || undefined,
      region: (req.recipient?.region || "청도읍") as Region,
      requestType: req.careType,
      desiredAt: req.requestedFor,
      isTimeFixed: req.exactTimeRequired ?? false,
      status: req.status,
      createdAt: req.createdAt,
    }));
  },

  async getSettings(): Promise<Settings> {
    const res = await apiFetch<ApiSettings>(`/admin/settings`);
    return {
      unitPrice: res.activityUnitPrice,
      totalBudget: res.totalBudget,
      monthlyBudget: res.monthlyBudget,
      regionShortageThreshold: 3,
      updatedAt: res.updatedAt,
    };
  },

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (patch.unitPrice !== undefined) payload.activityUnitPrice = patch.unitPrice;
    if (patch.totalBudget !== undefined) payload.totalBudget = patch.totalBudget;
    if (patch.monthlyBudget !== undefined) payload.monthlyBudget = patch.monthlyBudget;

    await apiFetch(`/admin/settings`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
};
