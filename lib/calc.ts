/**
 * 금액 계산식 — 다로리 관리자 대시보드
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  금액 계산은 전부 이 파일 안에서만 합니다.                    │
 * │  화면 컴포넌트 안에서 계산하지 마세요. 같은 "잔액"이          │
 * │  화면마다 다르게 나오는 사고가 여기서 시작됩니다.             │
 * └─────────────────────────────────────────────────────────────┘
 *
 * 근거: 앱 기획서 Ver 1.0 B-1(예산 탭), B-6(활동비 관리), C-5(출금)
 *
 * ⚠️ Phase 3에서 vitest 테스트를 반드시 작성할 것.
 *    경계 조건: 잔액 0 / 잔액 초과 신청 / 승인 취소로 음수 / 단가 변경 후 재산정 /
 *              paidTotal + approvedUnpaid + pendingEstimate 합이 맞는지
 *
 * 모든 금액은 정수(원). 나눗셈 결과는 반드시 Math.floor 로 내림합니다.
 */

import { LOG_STATUS, MANAGER_STATUS, PAYOUT_STATUS, REQUEST_STATUS, SETTLEMENT_STATUS } from './status'
import type {
  ActivityLog,
  BudgetSummary,
  CareRequest,
  Manager,
  MonthlyBudgetSummary,
  Payout,
  Recipient,
  Region,
  RegionStat,
  Settlement,
  Settings,
  Won,
  YearMonth,
} from './types'

// ═════════════════════════════════════════════════════════════
// 기본 단위
// ═════════════════════════════════════════════════════════════

/** 산정액 = 승인된 활동 건수 × 건당 단가 (기획서 B-6) */
export function calcSettlementAmount(logCount: number, unitPrice: Won): Won {
  return Math.max(0, Math.floor(logCount * unitPrice))
}

/** 승인된 정산의 합계 */
export function sumApprovedSettlements(settlements: Settlement[]): Won {
  return settlements
    .filter((s) => s.status === SETTLEMENT_STATUS.APPROVED)
    .reduce((sum, s) => sum + s.amount, 0)
}

/** 상태 무관 정산 총액 — 활동비 관리 화면 "해당 월 산정 총액" 요약 카드용 */
export function sumSettlements(settlements: Settlement[]): Won {
  return settlements.reduce((sum, s) => sum + s.amount, 0)
}

/** 임의의 목록에서 금액 필드를 뽑아 합산 — 표 하단 합계 행 등에 공용으로 사용 */
export function sumWon<T>(items: T[], amount: (item: T) => Won): Won {
  return items.reduce((sum, item) => sum + amount(item), 0)
}

/** 지급 완료된 출금 합계 = 기획서의 "지급 완료액" */
export function sumPaidPayouts(payouts: Payout[]): Won {
  return payouts
    .filter((p) => p.status === PAYOUT_STATUS.PAID)
    .reduce((sum, p) => sum + p.amount, 0)
}

/** 신청 중(아직 처리 안 된) 출금 합계 — 잔액에서 이미 빠진 것으로 계산 */
export function sumRequestedPayouts(payouts: Payout[]): Won {
  return payouts
    .filter((p) => p.status === PAYOUT_STATUS.REQUESTED)
    .reduce((sum, p) => sum + p.amount, 0)
}

/**
 * 출금 가능 잔액 (기획서 C-5)
 *   잔액 = 승인 정산 총액 − (신청 중 출금 + 지급 완료 출금)
 */
export function calcBalance(settlements: Settlement[], payouts: Payout[]): Won {
  const approved = sumApprovedSettlements(settlements)
  const outgoing = sumRequestedPayouts(payouts) + sumPaidPayouts(payouts)
  return approved - outgoing
}

// ═════════════════════════════════════════════════════════════
// 서버 가드에 대응하는 판정 함수
// ⚠️ 이건 화면에서 미리 막아주는 용도일 뿐입니다.
//    실제 차단은 서버가 해야 합니다 (docs 부록 C, 개발자 질문 17~20)
// ═════════════════════════════════════════════════════════════

/** 🟦 잔액 초과 출금 신청 차단 (기획서 C-5) */
export function canRequestPayout(amount: Won, balance: Won): boolean {
  return amount > 0 && amount <= balance
}

/** 🟦 승인 취소는 잔액이 음수가 되지 않을 때만 허용 (기획서 B-6) */
export function canCancelSettlementApproval(
  settlement: Settlement,
  currentBalance: Won,
): boolean {
  return currentBalance - settlement.amount >= 0
}

// ═════════════════════════════════════════════════════════════
// 대시보드 예산 탭 — 기획서 B-1
// 🟦 돈을 네 상태로 쪼갭니다. 하나로 합치지 마세요.
// ═════════════════════════════════════════════════════════════

export function calcBudgetSummary(
  settings: Settings,
  settlements: Settlement[],
  payouts: Payout[],
  logs: ActivityLog[],
): BudgetSummary {
  // 승인 정산 총액 — 사용률의 분자
  const approvedTotal = sumApprovedSettlements(settlements)

  // ① 지급 완료액 = 실제 지급된 출금 합계 (기획서 규칙 명시)
  const paidTotal = sumPaidPayouts(payouts)

  // ② 정산 필요 (승인 미지급) — 승인은 됐는데 아직 안 나간 돈
  //    신청 중인 것도 아직 안 나갔지만, "처리 대기"이므로 여기서 뺍니다
  const requestedTotal = sumRequestedPayouts(payouts)
  const approvedUnpaid = Math.max(0, approvedTotal - paidTotal - requestedTotal)

  // ③ 승인 대기 예상액 = 검토 대기 일지 건수 × 단가
  //    아직 정산 테이블에 들어가지도 않은 "추정" 금액
  const pendingLogCount = logs.filter((l) => l.status === LOG_STATUS.PENDING).length
  const pendingEstimate = calcSettlementAmount(pendingLogCount, settings.unitPrice)

  // 사용률 = 승인 정산 총액 ÷ 전체 예산
  const usageRate =
    settings.totalBudget > 0 ? approvedTotal / settings.totalBudget : 0

  const remaining = settings.totalBudget - approvedTotal

  // 활동 평균 지급액 = 지급 완료액 ÷ 지급 대상 활동 건수
  const approvedLogCount = logs.filter((l) => l.status === LOG_STATUS.APPROVED).length
  const averagePerActivity =
    approvedLogCount > 0 ? Math.floor(paidTotal / approvedLogCount) : 0

  // 남은 예산 기준 예상 가능 활동 횟수 = 남은 예산 ÷ 단가
  const possibleActivities =
    settings.unitPrice > 0 ? Math.max(0, Math.floor(remaining / settings.unitPrice)) : 0

  return {
    totalBudget: settings.totalBudget,
    paidTotal,
    approvedUnpaid,
    pendingEstimate,
    usageRate,
    remaining,
    averagePerActivity,
    possibleActivities,
  }
}

export function calcMonthlyBudgetSummary(
  yearMonth: YearMonth,
  settings: Settings,
  settlements: Settlement[],
  logs: ActivityLog[],
): MonthlyBudgetSummary {
  const monthly = settlements.filter((s) => s.yearMonth === yearMonth)

  const approved = sumApprovedSettlements(monthly)
  const calculating = monthly
    .filter((s) => s.status === SETTLEMENT_STATUS.CALCULATED)
    .reduce((sum, s) => sum + s.amount, 0)

  // 이번 달 예상 활동비 = 이번 달 승인 일지 건수 × 단가
  const monthlyApprovedLogs = logs.filter(
    (l) => l.status === LOG_STATUS.APPROVED && l.activityDate.startsWith(yearMonth),
  ).length
  const estimated = calcSettlementAmount(monthlyApprovedLogs, settings.unitPrice)

  return {
    yearMonth,
    assigned: settings.monthlyBudget,
    approved,
    calculating,
    remaining: settings.monthlyBudget - approved,
    estimated,
  }
}

/** 🟦 배정 예산 미설정(0) 시 설정 페이지 안내 노출 (기획서 B-1 규칙) */
export function needsMonthlyBudgetSetup(settings: Settings): boolean {
  return settings.monthlyBudget <= 0
}

// ═════════════════════════════════════════════════════════════
// 대시보드 액션 큐 — docs/대시보드_재설계.md 4장 (Phase 13)
// 판정 로직은 전부 여기. 화면에서 계산하지 않는다.
// ═════════════════════════════════════════════════════════════

/** 🟨 /requests 의 "배정 지연" 배지와 공유하는 기준. 두 곳에서 갈리면 숫자가 안 맞는다 */
export const STALE_HOURS = 24

/** 가장 오래된 pending 일지의 경과 일수. pending이 없으면 0 */
export function oldestPendingDays(logs: ActivityLog[], now: Date): number {
  const pending = logs.filter((l) => l.status === LOG_STATUS.PENDING)
  if (pending.length === 0) return 0
  const oldestCreatedAt = Math.min(...pending.map((l) => new Date(l.createdAt).getTime()))
  return Math.floor((now.getTime() - oldestCreatedAt) / (1000 * 60 * 60 * 24))
}

/** requested 상태이면서 접수 후 STALE_HOURS 이상 경과한 요청 건수 */
export function staleRequestCount(requests: CareRequest[], now: Date): number {
  return requests.filter(
    (r) =>
      r.status === REQUEST_STATUS.REQUESTED &&
      now.getTime() - new Date(r.createdAt).getTime() >= STALE_HOURS * 60 * 60 * 1000,
  ).length
}

/** 매니저 심사 대기 인원 = applied + educated */
export function pendingManagerCount(managers: Manager[]): number {
  return managers.filter(
    (m) => m.status === MANAGER_STATUS.APPLIED || m.status === MANAGER_STATUS.EDUCATED,
  ).length
}

/**
 * 잔액이 남아 있는 매니저 수 = 승인 미지급이 걸린 인원
 * 🟨 매니저별 잔액은 기존 calcBalance() 재사용. 삭제된 매니저도 잔액이 있으면 포함
 * (기획서: 삭제된 매니저도 지급 이력이 있으면 표에 유지)
 */
export function unpaidManagerCount(
  managers: Manager[],
  settlements: Settlement[],
  payouts: Payout[],
): number {
  return managers.filter((m) => {
    const balance = calcBalance(
      settlements.filter((s) => s.managerId === m.id),
      payouts.filter((p) => p.managerId === m.id),
    )
    return balance > 0
  }).length
}

/** requested 상태 출금 중 가장 오래된 건의 경과 일수. 없으면 0 */
export function oldestRequestedPayoutDays(payouts: Payout[], now: Date): number {
  const requested = payouts.filter((p) => p.status === PAYOUT_STATUS.REQUESTED)
  if (requested.length === 0) return 0
  const oldestCreatedAt = Math.min(...requested.map((p) => new Date(p.createdAt).getTime()))
  return Math.floor((now.getTime() - oldestCreatedAt) / (1000 * 60 * 60 * 24))
}

/** 심사 대기 인원 단계별 분해 */
export function managerReviewBreakdown(managers: Manager[]): { applied: number; educated: number } {
  return {
    applied: managers.filter((m) => m.status === MANAGER_STATUS.APPLIED).length,
    educated: managers.filter((m) => m.status === MANAGER_STATUS.EDUCATED).length,
  }
}

/** 담당 매니저가 없는 대상자 수 (삭제된 대상자는 제외) */
export function unassignedRecipientCount(recipients: Recipient[]): number {
  return recipients.filter((r) => !r.deletedAt && !r.managerId).length
}

/**
 * 미배정 대상자의 읍·면별 분해. count 내림차순 → 지역명 오름차순(동률 정렬 고정)
 * 🟨 unassignedRecipientCount() 와 판정 조건이 반드시 같아야 한다 (!r.deletedAt && !r.managerId)
 */
export function unassignedRecipientsByRegion(
  recipients: Recipient[],
): { region: Region; count: number }[] {
  const counts = new Map<Region, number>()
  for (const r of recipients) {
    if (r.deletedAt || r.managerId) continue
    counts.set(r.region, (counts.get(r.region) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region, 'ko'))
}

/** 매니저 부족 지역 이름 목록 */
export function shortageRegions(regions: RegionStat[]): Region[] {
  return regions.filter((r) => r.isShortage).map((r) => r.region)
}

// ═════════════════════════════════════════════════════════════
// 지역 판정 — 기획서 B-1 탭3
// ═════════════════════════════════════════════════════════════

/**
 * 🟦 "도움이 더 필요한 지역" 자동 판정
 *   대상자가 있는데, 활동가능 매니저가 없거나, 매니저 1명당 대상자가 임계값 이상
 *
 * 🟨 임계값은 기획서상 3 고정이지만 설정으로 뺐습니다 (settings.regionShortageThreshold)
 */
export function isRegionShortage(
  recipientCount: number,
  activeManagerCount: number,
  threshold: number,
): boolean {
  if (recipientCount <= 0) return false
  if (activeManagerCount === 0) return true
  return recipientCount / activeManagerCount >= threshold
}

/** 지도 채움 색 진하기 (0~1). 대상자 수가 가장 많은 지역이 1 */
export function regionFillIntensity(stat: RegionStat, allStats: RegionStat[]): number {
  const max = Math.max(...allStats.map((s) => s.recipientCount), 0)
  if (max <= 0) return 0
  return stat.recipientCount / max
}

// ═════════════════════════════════════════════════════════════
// 표시 형식
// ═════════════════════════════════════════════════════════════

/** ₩20,000,000 — 기획서 화면 표기 방식. 표에서는 축약 금지 */
export function formatWon(amount: Won): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

/** 12.3% */
export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}
