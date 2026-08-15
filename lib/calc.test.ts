import { describe, expect, it } from 'vitest'

import {
  calcBalance,
  calcBudgetSummary,
  calcMonthlyBudgetSummary,
  calcSettlementAmount,
  canCancelSettlementApproval,
  canRequestPayout,
  formatRate,
  formatWon,
  isRegionShortage,
  needsMonthlyBudgetSetup,
  regionFillIntensity,
  sumApprovedSettlements,
  sumPaidPayouts,
  sumRequestedPayouts,
  sumSettlements,
} from './calc'
import { ACTIVITY_TYPE, LOG_STATUS, PAYOUT_STATUS, SETTLEMENT_STATUS } from './status'
import type { ActivityLog, Payout, RegionStat, Settings, Settlement } from './types'

// ═════════════════════════════════════════════════════════════
// 픽스처 도우미
// ═════════════════════════════════════════════════════════════

function makeSettlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: 'stl-test',
    managerId: 'mgr-1',
    yearMonth: '2026-08',
    logCount: 4,
    unitPrice: 25000,
    amount: 100000,
    status: SETTLEMENT_STATUS.APPROVED,
    createdAt: '2026-08-01T09:00:00+09:00',
    ...overrides,
  }
}

function makePayout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: 'pay-test',
    managerId: 'mgr-1',
    amount: 30000,
    status: PAYOUT_STATUS.PAID,
    createdAt: '2026-08-01T09:00:00+09:00',
    ...overrides,
  }
}

function makeLog(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 'log-test',
    managerId: 'mgr-1',
    recipientId: 'rcp-1',
    activityDate: '2026-08-10',
    startedAt: '2026-08-10T09:00:00+09:00',
    endedAt: '2026-08-10T10:30:00+09:00',
    activityType: ACTIVITY_TYPE.GENERAL,
    place: '청도읍 자택',
    participantCount: 1,
    content: '말벗 및 안부 확인',
    isManual: false,
    status: LOG_STATUS.APPROVED,
    photos: [],
    createdAt: '2026-08-10T10:30:00+09:00',
    ...overrides,
  }
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    unitPrice: 25000,
    totalBudget: 200_000_000,
    monthlyBudget: 18_000_000,
    regionShortageThreshold: 3,
    updatedAt: '2026-08-01T09:00:00+09:00',
    ...overrides,
  }
}

// ═════════════════════════════════════════════════════════════
// 기본 단위
// ═════════════════════════════════════════════════════════════

describe('calcSettlementAmount', () => {
  it('건수 × 단가를 정수로 반환한다', () => {
    expect(calcSettlementAmount(4, 25000)).toBe(100000)
  })

  it('음수가 나오지 않도록 0으로 바닥 처리한다', () => {
    expect(calcSettlementAmount(-3, 25000)).toBe(0)
  })

  it('결과는 항상 정수(내림)다', () => {
    expect(calcSettlementAmount(3, 10000.7)).toBe(Math.floor(3 * 10000.7))
    expect(Number.isInteger(calcSettlementAmount(3, 10000.7))).toBe(true)
  })
})

describe('sumApprovedSettlements / sumPaidPayouts / sumRequestedPayouts', () => {
  it('승인된 정산만 합산한다', () => {
    const settlements = [
      makeSettlement({ id: 's1', status: SETTLEMENT_STATUS.APPROVED, amount: 100000 }),
      makeSettlement({ id: 's2', status: SETTLEMENT_STATUS.CALCULATED, amount: 50000 }),
      makeSettlement({ id: 's3', status: SETTLEMENT_STATUS.APPROVED, amount: 75000 }),
    ]
    expect(sumApprovedSettlements(settlements)).toBe(175000)
  })

  it('지급 완료된 출금만 합산한다', () => {
    const payouts = [
      makePayout({ id: 'p1', status: PAYOUT_STATUS.PAID, amount: 30000 }),
      makePayout({ id: 'p2', status: PAYOUT_STATUS.REQUESTED, amount: 20000 }),
      makePayout({ id: 'p3', status: PAYOUT_STATUS.REJECTED, amount: 10000 }),
    ]
    expect(sumPaidPayouts(payouts)).toBe(30000)
  })

  it('신청 중인 출금만 합산한다', () => {
    const payouts = [
      makePayout({ id: 'p1', status: PAYOUT_STATUS.PAID, amount: 30000 }),
      makePayout({ id: 'p2', status: PAYOUT_STATUS.REQUESTED, amount: 20000 }),
      makePayout({ id: 'p3', status: PAYOUT_STATUS.REQUESTED, amount: 15000 }),
    ]
    expect(sumRequestedPayouts(payouts)).toBe(35000)
  })

  it('빈 배열은 0을 반환한다', () => {
    expect(sumApprovedSettlements([])).toBe(0)
    expect(sumPaidPayouts([])).toBe(0)
    expect(sumRequestedPayouts([])).toBe(0)
  })
})

describe('sumSettlements', () => {
  it('상태와 무관하게 전부 합산한다', () => {
    const settlements = [
      makeSettlement({ id: 's1', status: SETTLEMENT_STATUS.APPROVED, amount: 100000 }),
      makeSettlement({ id: 's2', status: SETTLEMENT_STATUS.CALCULATED, amount: 50000 }),
    ]
    expect(sumSettlements(settlements)).toBe(150000)
  })
})

describe('calcBalance', () => {
  it('잔액 = 승인 정산 총액 − (신청 중 + 지급 완료)', () => {
    const settlements = [makeSettlement({ status: SETTLEMENT_STATUS.APPROVED, amount: 100000 })]
    const payouts = [
      makePayout({ id: 'p1', status: PAYOUT_STATUS.PAID, amount: 30000 }),
      makePayout({ id: 'p2', status: PAYOUT_STATUS.REQUESTED, amount: 20000 }),
    ]
    expect(calcBalance(settlements, payouts)).toBe(50000)
  })

  it('경계 조건: 정산·출금이 정확히 일치하면 잔액 0', () => {
    const settlements = [makeSettlement({ amount: 100000 })]
    const payouts = [makePayout({ status: PAYOUT_STATUS.PAID, amount: 100000 })]
    expect(calcBalance(settlements, payouts)).toBe(0)
  })

  it('반려된 출금은 잔액 계산에서 제외된다 (반려 금액은 잔액으로 복귀)', () => {
    const settlements = [makeSettlement({ amount: 100000 })]
    const payouts = [makePayout({ status: PAYOUT_STATUS.REJECTED, amount: 100000 })]
    expect(calcBalance(settlements, payouts)).toBe(100000)
  })

  it('산정만 되고 승인 안 된 정산은 잔액에 반영되지 않는다', () => {
    const settlements = [makeSettlement({ status: SETTLEMENT_STATUS.CALCULATED, amount: 100000 })]
    expect(calcBalance(settlements, [])).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════
// 서버 가드 판정 함수 — 경계 조건 위주
// ═════════════════════════════════════════════════════════════

describe('canRequestPayout', () => {
  it('잔액 이하 금액은 허용한다', () => {
    expect(canRequestPayout(50000, 100000)).toBe(true)
  })

  it('경계 조건: 신청 금액 == 잔액이면 허용한다', () => {
    expect(canRequestPayout(100000, 100000)).toBe(true)
  })

  it('잔액을 초과하면 차단한다', () => {
    expect(canRequestPayout(100001, 100000)).toBe(false)
  })

  it('0원 이하 신청은 차단한다', () => {
    expect(canRequestPayout(0, 100000)).toBe(false)
    expect(canRequestPayout(-10000, 100000)).toBe(false)
  })
})

describe('canCancelSettlementApproval', () => {
  it('취소해도 잔액이 0 이상이면 허용한다', () => {
    const settlement = makeSettlement({ amount: 40000 })
    expect(canCancelSettlementApproval(settlement, 100000)).toBe(true)
  })

  it('경계 조건: 취소 후 잔액이 정확히 0이면 허용한다', () => {
    const settlement = makeSettlement({ amount: 100000 })
    expect(canCancelSettlementApproval(settlement, 100000)).toBe(true)
  })

  it('취소하면 잔액이 음수가 되는 경우 차단한다', () => {
    const settlement = makeSettlement({ amount: 100001 })
    expect(canCancelSettlementApproval(settlement, 100000)).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════
// 대시보드 예산 탭
// ═════════════════════════════════════════════════════════════

describe('calcBudgetSummary', () => {
  it('네 가지 금액(지급완료/정산필요/승인대기예상/남은예산)을 정확히 분리한다', () => {
    const settings = makeSettings({ unitPrice: 25000, totalBudget: 10_000_000 })
    const settlements = [makeSettlement({ status: SETTLEMENT_STATUS.APPROVED, amount: 300000 })]
    const payouts = [
      makePayout({ id: 'p1', status: PAYOUT_STATUS.PAID, amount: 100000 }),
      makePayout({ id: 'p2', status: PAYOUT_STATUS.REQUESTED, amount: 50000 }),
    ]
    const logs = [
      makeLog({ id: 'l1', status: LOG_STATUS.PENDING }),
      makeLog({ id: 'l2', status: LOG_STATUS.PENDING }),
      makeLog({ id: 'l3', status: LOG_STATUS.APPROVED }),
    ]

    const result = calcBudgetSummary(settings, settlements, payouts, logs)

    expect(result.paidTotal).toBe(100000)
    // 정산 필요(승인 미지급) = 승인 정산 총액 − 지급완료 − 신청중
    expect(result.approvedUnpaid).toBe(300000 - 100000 - 50000)
    // 승인 대기 예상액 = 검토 대기 일지 수 × 단가
    expect(result.pendingEstimate).toBe(2 * 25000)
    expect(result.remaining).toBe(10_000_000 - 300000)
    expect(result.usageRate).toBeCloseTo(300000 / 10_000_000)
  })

  it('전체 예산이 0이면 사용률은 0이다 (0으로 나누지 않는다)', () => {
    const settings = makeSettings({ totalBudget: 0 })
    const result = calcBudgetSummary(settings, [], [], [])
    expect(result.usageRate).toBe(0)
  })

  it('승인된 지급 대상 활동이 없으면 평균 지급액은 0이다', () => {
    const settings = makeSettings()
    const result = calcBudgetSummary(settings, [], [], [])
    expect(result.averagePerActivity).toBe(0)
    expect(result.possibleActivities).toBeGreaterThanOrEqual(0)
  })

  it('단가가 0이면 가능 활동 횟수는 0이다 (0으로 나누지 않는다)', () => {
    const settings = makeSettings({ unitPrice: 0 })
    const result = calcBudgetSummary(settings, [], [], [])
    expect(result.possibleActivities).toBe(0)
  })
})

describe('calcMonthlyBudgetSummary', () => {
  it('해당 월의 산정/승인 정산만 집계한다', () => {
    const settings = makeSettings({ monthlyBudget: 1_000_000, unitPrice: 25000 })
    const settlements = [
      makeSettlement({ id: 's1', yearMonth: '2026-08', status: SETTLEMENT_STATUS.APPROVED, amount: 200000 }),
      makeSettlement({ id: 's2', yearMonth: '2026-08', status: SETTLEMENT_STATUS.CALCULATED, amount: 50000 }),
      makeSettlement({ id: 's3', yearMonth: '2026-07', status: SETTLEMENT_STATUS.APPROVED, amount: 999999 }),
    ]
    const logs = [
      makeLog({ id: 'l1', activityDate: '2026-08-05', status: LOG_STATUS.APPROVED }),
      makeLog({ id: 'l2', activityDate: '2026-07-05', status: LOG_STATUS.APPROVED }),
    ]

    const result = calcMonthlyBudgetSummary('2026-08', settings, settlements, logs)

    expect(result.approved).toBe(200000)
    expect(result.calculating).toBe(50000)
    expect(result.remaining).toBe(1_000_000 - 200000)
    expect(result.estimated).toBe(1 * 25000)
  })
})

describe('needsMonthlyBudgetSetup', () => {
  it('배정 예산이 0이면 true다', () => {
    expect(needsMonthlyBudgetSetup(makeSettings({ monthlyBudget: 0 }))).toBe(true)
  })

  it('배정 예산이 있으면 false다', () => {
    expect(needsMonthlyBudgetSetup(makeSettings({ monthlyBudget: 1 }))).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════
// 지역 판정
// ═════════════════════════════════════════════════════════════

describe('isRegionShortage', () => {
  it('대상자가 없으면 매니저가 0명이어도 부족 지역이 아니다', () => {
    expect(isRegionShortage(0, 0, 3)).toBe(false)
  })

  it('대상자가 있는데 활동가능 매니저가 0명이면 부족 지역이다', () => {
    expect(isRegionShortage(5, 0, 3)).toBe(true)
  })

  it('경계 조건: 대상자/매니저 비율이 임계값과 정확히 같으면 부족 지역이다', () => {
    expect(isRegionShortage(9, 3, 3)).toBe(true)
  })

  it('비율이 임계값 미만이면 부족 지역이 아니다', () => {
    expect(isRegionShortage(5, 3, 3)).toBe(false)
  })
})

describe('regionFillIntensity', () => {
  const stats: RegionStat[] = [
    { region: '청도읍', recipientCount: 10, activeManagerCount: 3, assignedManagerCount: 3, monthlyLogCount: 5, isShortage: false },
    { region: '화양읍', recipientCount: 5, activeManagerCount: 1, assignedManagerCount: 1, monthlyLogCount: 2, isShortage: false },
    { region: '이서면', recipientCount: 0, activeManagerCount: 0, assignedManagerCount: 0, monthlyLogCount: 0, isShortage: false },
  ]

  it('대상자가 가장 많은 지역은 1이다', () => {
    expect(regionFillIntensity(stats[0], stats)).toBe(1)
  })

  it('비율에 맞게 0~1 사이 값을 반환한다', () => {
    expect(regionFillIntensity(stats[1], stats)).toBeCloseTo(0.5)
  })

  it('전체 대상자가 0명이면 0을 반환한다 (0으로 나누지 않는다)', () => {
    const empty: RegionStat[] = [{ ...stats[2] }]
    expect(regionFillIntensity(empty[0], empty)).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════
// 표시 형식
// ═════════════════════════════════════════════════════════════

describe('formatWon / formatRate', () => {
  it('₩ 기호와 천 단위 구분자를 붙인다', () => {
    expect(formatWon(20000000)).toBe('₩20,000,000')
  })

  it('비율을 소수점 1자리 퍼센트로 표시한다', () => {
    expect(formatRate(0.1234)).toBe('12.3%')
  })
})
