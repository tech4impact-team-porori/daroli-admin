/**
 * 도메인 타입 — 다로리 관리자 대시보드
 *
 * 근거: 앱 기획서 Ver 1.0 화면 명세 (docs/관리자대시보드_제작기획.md 2장)
 *
 * 주의
 *  - 상태값은 전부 lib/status.ts 에서 가져옵니다. 여기서 문자열을 새로 만들지 마세요.
 *  - `?` 가 붙은 필드 = 값이 없을 수 있음. 화면에서 반드시 없는 경우를 처리해야 합니다.
 *    (미배정 대상자, GPS 없는 수동 완료 일지 등 — 기획서에 명시된 실제 상황들)
 *  - 금액은 전부 정수(원). 소수점 금지.
 *  - 날짜/시간은 ISO8601 문자열. 백엔드와 타임존 합의 필요 (docs 부록 C-6)
 */

import type {
  ActivityType,
  LogStatus,
  ManagerStatus,
  PayoutStatus,
  Region,
  RecipientType,
  RequestStatus,
  RequestType,
  SettlementStatus,
  UserRole,
} from './status'

/**
 * 상태 타입 재수출 — 화면에서 `from '@/lib/types'` 하나로 다 가져올 수 있게.
 * 값(상수)은 `lib/status.ts` 에서 직접 가져오세요.
 */
export type {
  ActivityType,
  LogStatus,
  ManagerStatus,
  PayoutStatus,
  Region,
  RecipientType,
  RequestStatus,
  RequestType,
  SettlementStatus,
  Tone,
  UserRole,
} from './status'

/** 원 단위 정수 금액. `number` 라고만 쓰면 실수로 소수점이 들어옵니다 */
export type Won = number

/** ISO8601 문자열 (예: '2026-08-13T09:30:00+09:00') */
export type ISODateTime = string

/** 'YYYY-MM-DD' */
export type ISODate = string

/** 'YYYY-MM' — 월별 정산 키 */
export type YearMonth = string

// ═════════════════════════════════════════════════════════════
// 계정
// ═════════════════════════════════════════════════════════════
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
}

// ═════════════════════════════════════════════════════════════
// 매니저 — 기획서 A-2(지원서), B-5(관리 표)
// ═════════════════════════════════════════════════════════════
export interface Manager {
  id: string
  name: string
  email: string
  phone: string
  /** 거주 읍·면 */
  homeRegion: Region
  /** 활동 가능 지역 — 최대 10개 (MAX_ACTIVITY_REGIONS) */
  activityRegions: Region[]
  /** 자차 보유 — 없으면 이동·라이딩 요청 배정 불가 (기획서 A-2) */
  hasCar: boolean
  status: ManagerStatus
  createdAt: ISODateTime
  /**
   * 삭제 표시 시각. 값이 있으면 목록에서 숨김.
   * 🟦 기획서 B-1 탭2: 삭제된 매니저도 지급 이력이 있으면 표에 유지
   *    → 실제로 지우지 않고 이 필드만 채웁니다
   */
  deletedAt?: ISODateTime
}

/**
 * 매니저 + 집계값.
 * 🔴 집계값은 DB에 저장되지 않습니다 (docs/백엔드_소통가이드.md 3-3).
 *    백엔드에 "목록에 이것까지 포함해서 한 번에" 요청해야 합니다.
 *    따로 부르면 매니저 수만큼 요청이 늘어납니다 (N+1).
 */
export interface ManagerWithStats extends Manager {
  /** 담당 대상자 수 */
  recipientCount: number
  /** 이번 달 활동 건수 (승인 기준) */
  monthlyLogCount: number
  /** 누적 활동 건수 */
  totalLogCount: number
  /** 승인 누적액 = 승인된 정산 합계 */
  approvedTotal: Won
  /** 지급 완료액 = paid 출금 합계 */
  paidTotal: Won
  /** 출금 가능 잔액 = 승인 누적액 − (신청중 + 지급완료) */
  balance: Won
}

// ═════════════════════════════════════════════════════════════
// 대상자 — 기획서 B-4
// 🔴 민감정보 포함: careNeeds(건강 상태), addressDetail(상세 주소)
// ═════════════════════════════════════════════════════════════
export interface Recipient {
  id: string
  name: string
  type: RecipientType
  /** 아동인 경우 나이 표기 (기획서 예: 김햇님(11세)) */
  age?: number
  region: Region
  /** 🔴 개인정보 — 마스킹 대상 */
  addressDetail: string
  phone?: string
  /** 🔴 민감정보(건강 상태) — 마스킹 대상 */
  careNeeds?: string
  /**
   * 담당 매니저.
   * 🟦 없을 수 있음 — 기획서 B-4 "미배정 시 경고 배지"
   *    이 배정 정보가 지역별 통계의 기준입니다
   */
  managerId?: string
  createdAt: ISODateTime
  deletedAt?: ISODateTime
}

export interface RecipientWithManager extends Recipient {
  /** managerId 가 없으면 이것도 없음 */
  manager?: Pick<Manager, 'id' | 'name' | 'status'>
}

// ═════════════════════════════════════════════════════════════
// 돌봄 요청 — 기획서 B-2, D-2
// ═════════════════════════════════════════════════════════════
export interface CareRequest {
  id: string
  recipientId: string
  /** 배정 매니저. 배정 전이면 없음 */
  managerId?: string
  requestType: RequestType
  /** 요청자가 희망한 일시 */
  desiredAt: ISODateTime
  /** 🟦 "이 시간에 꼭 가야 해요" — true면 매니저가 시간 변경 불가 */
  isTimeFixed: boolean
  /** 요청 사유·특이사항 */
  note?: string
  status: RequestStatus
  /** 매니저가 제안한 시간 (status=proposed 일 때만) */
  proposedAt?: ISODateTime
  /** 최종 확정된 방문 시간 */
  confirmedAt?: ISODateTime
  createdAt: ISODateTime
}

/** 요청 현황 표 한 줄 — 기획서 B-2 컬럼 */
export interface CareRequestRow extends CareRequest {
  recipientName: string
  managerName?: string
  region: Region
}

// ═════════════════════════════════════════════════════════════
// 활동일지 — 기획서 B-3(검토 카드), C-3(작성 폼)
// ═════════════════════════════════════════════════════════════
export interface GpsRecord {
  lat: number
  lng: number
  at: ISODateTime
}

export interface ActivityLog {
  id: string
  requestId?: string
  managerId: string
  recipientId: string

  activityDate: ISODate
  startedAt: ISODateTime
  endedAt: ISODateTime
  activityType: ActivityType
  /** 활동 장소 — 자동 채움 시 대상자 주소 */
  place: string
  /** 🟦 참여 인원 — 기획서 B-3 검토 카드 항목 */
  participantCount: number
  /** 활동 내용 */
  content: string
  /** 특이사항 — 🔴 "대상자 건강 상태 변화" 기재 지시 = 민감정보 */
  note?: string

  /** 🟦 GPS — 없을 수 있음. 수동 완료 경로가 기획서에 있음 (C-2-1) */
  gpsStart?: GpsRecord
  gpsEnd?: GpsRecord
  /** 시작-종료 지점 거리(m) */
  gpsDistance?: number
  /** GPS 없이 수동 완료 처리된 건 */
  isManual: boolean

  status: LogStatus
  /** 🟦 반려 시 필수 */
  rejectReason?: string
  reviewedBy?: string
  reviewedAt?: ISODateTime

  photos: LogPhoto[]
  createdAt: ISODateTime
}

export interface LogPhoto {
  id: string
  url: string
}

/** 검토 화면 카드 — 기획서 B-3 항목 전부 */
export interface ActivityLogCard extends ActivityLog {
  managerName: string
  recipientName: string
  recipientType: RecipientType
  region: Region
}

// ═════════════════════════════════════════════════════════════
// 월별 정산 — 기획서 B-6
// 🟦 정산은 2단계: 생성(calculated) → 승인(approved). 승인 시점에 잔액 적립
// ═════════════════════════════════════════════════════════════
export interface Settlement {
  id: string
  managerId: string
  yearMonth: YearMonth
  /** 승인된 일지 건수 */
  logCount: number
  /** 산정 당시의 단가 (나중에 단가가 바뀌어도 과거 정산은 그대로) */
  unitPrice: Won
  /** 산정액 = logCount × unitPrice */
  amount: Won
  status: SettlementStatus
  approvedBy?: string
  approvedAt?: ISODateTime
  createdAt: ISODateTime
}

export interface SettlementRow extends Settlement {
  managerName: string
}

// ═════════════════════════════════════════════════════════════
// 출금 — 기획서 B-6, C-5
// ═════════════════════════════════════════════════════════════
export interface Payout {
  id: string
  managerId: string
  amount: Won
  status: PayoutStatus
  /** 🟦 반려 시 필수. 반려된 금액은 잔액으로 복귀 */
  rejectReason?: string
  processedBy?: string
  processedAt?: ISODateTime
  createdAt: ISODateTime
}

export interface PayoutRow extends Payout {
  managerName: string
}

// ═════════════════════════════════════════════════════════════
// 시스템 설정 — 기획서 B-7
// ═════════════════════════════════════════════════════════════
export interface Settings {
  /** 🟦 활동 1회 기준 단가. 0보다 커야 함 */
  unitPrice: Won
  /** 🟦 사업 전체 예산. 0 = 미설정 */
  totalBudget: Won
  /** 🟦 이번 달 배정 예산. 0 = 미설정 → 설정 페이지 안내 노출 */
  monthlyBudget: Won
  /**
   * 🟨 추가 제안 — 기획서는 3 고정
   * "도움이 더 필요한 지역" 판정: 매니저 1명당 대상자 N명 이상
   */
  regionShortageThreshold: number
  updatedAt: ISODateTime
}

// ═════════════════════════════════════════════════════════════
// 대시보드 집계 — 기획서 B-1
// ═════════════════════════════════════════════════════════════

/**
 * 🟦 예산 현황(전체) — 기획서 B-1 탭1의 핵심.
 * 돈을 네 상태로 쪼개서 보여줍니다. 하나로 합치지 마세요.
 */
export interface BudgetSummary {
  /** settings.totalBudget */
  totalBudget: Won
  /** 실제 지급된 출금 합계 (payouts: paid) */
  paidTotal: Won
  /** ⚠️ 승인됐지만 아직 안 나간 돈 — 화면에서 주황 강조 */
  approvedUnpaid: Won
  /** 검토 대기 일지 건수 × 단가 = 아직 확정 안 된 예상 금액 */
  pendingEstimate: Won
  /** 승인 정산 총액 ÷ 전체 예산 (0~1) */
  usageRate: number
  /** 전체 예산 − 승인 정산 총액 */
  remaining: Won
  /** 활동 평균 지급액 */
  averagePerActivity: Won
  /** 남은 예산 ÷ 단가 (내림) */
  possibleActivities: number
}

/** 🟦 이번 달 예산 현황 — 기획서 B-1 탭1 */
export interface MonthlyBudgetSummary {
  yearMonth: YearMonth
  /** settings.monthlyBudget. 0이면 미설정 → 안내 노출 */
  assigned: Won
  /** 이번 달 승인 정산액 */
  approved: Won
  /** 이번 달 산정 중(미승인) 금액 */
  calculating: Won
  /** 배정 − 승인 */
  remaining: Won
  /** 이번 달 예상 활동비 KPI */
  estimated: Won
}

/** 🟦 지역별 현황 — 지도 + 지역별 표 공용 (기획서 B-1 탭2·탭3) */
export interface RegionStat {
  region: Region
  /** 거주 대상자 수 — 지도 채움 색의 기준 */
  recipientCount: number
  /** 활동 가능(active) 매니저 수 */
  activeManagerCount: number
  /** 배정된 매니저 수 */
  assignedManagerCount: number
  /** 이달 활동 건수 */
  monthlyLogCount: number
  /**
   * 🟦 "도움이 더 필요한 지역" — 붉은 테두리
   * 판정: 대상자 > 0 AND (활동가능 매니저 == 0 OR 대상자/매니저 >= 임계값)
   */
  isShortage: boolean
}

/** 🟦 최근 6개월 활동 추이 — 기획서 B-1 탭3. 제출/승인 2계열 */
export interface MonthlyTrendPoint {
  yearMonth: YearMonth
  submitted: number
  approved: number
}

/** 🟦 매니저별 지급 현황 표 — 기획서 B-1 탭2 (승인액 내림차순) */
export interface ManagerPaymentRow {
  managerId: string
  managerName: string
  /** 삭제·비활성이지만 지급 이력이 있어 표에 남은 경우 */
  isRetired: boolean
  monthlyLogCount: number
  approvedTotal: Won
  paidTotal: Won
  balance: Won
}

/**
 * 🟨 대시보드 "지금 처리할 일" 액션 큐 — docs/대시보드_재설계.md 4장·7장 (Phase 13)
 * 전부 기존 데이터에서 계산 가능. 판정 로직은 lib/calc.ts 에만 둔다.
 */
export interface ActionQueue {
  /** 1. 승인됐지만 아직 안 나간 돈 (BudgetSummary.approvedUnpaid 와 동일) */
  approvedUnpaid: Won
  /** 2. 출금 신청 대기 건수 */
  requestedPayoutCount: number
  /** 3. 검토 대기 일지 건수 (DashboardData.pendingLogCount 와 동일) */
  pendingLogCount: number
  /** 3. 가장 오래된 pending 일지의 경과 일수 */
  oldestPendingDays: number
  /** 4. requested 상태이면서 접수 후 24시간 경과한 요청 건수 */
  staleRequestCount: number
  /** 5. 매니저 심사 대기 인원 (applied + educated) */
  pendingManagerCount: number
  /** 6. 담당 매니저가 없는 대상자 수 */
  unassignedRecipientCount: number
  /** 7. 매니저 부족 지역 목록 */
  shortageRegions: Region[]
  /** 8. 이번 달 배정 예산 미설정 여부 */
  needsBudgetSetup: boolean

  // ── 신규 (detail 표시 전용, Phase 13-1) ──
  /** 🟨 1. 잔액(=승인 미지급)이 남아 있는 매니저 수 */
  unpaidManagerCount: number
  /** 🟨 2. requested 상태 출금 중 가장 오래된 건의 경과 일수. 없으면 0 */
  oldestRequestedPayoutDays: number
  /** 🟨 5. 심사 대기 인원의 단계별 분해 (applied / educated) */
  appliedManagerCount: number
  educatedManagerCount: number
  /** 🟨 6. 미배정 대상자의 읍·면 분해. count 내림차순 */
  unassignedByRegion: { region: Region; count: number }[]
  /** 🟨 8. 배정 예산이 미설정된 대상 월 */
  budgetSetupMonth: YearMonth
}

/** 대시보드 전체 */
export interface DashboardData {
  /** 공통 상단 배너 — 검토 대기 일지 건수 */
  pendingLogCount: number

  budget: BudgetSummary
  monthlyBudget: MonthlyBudgetSummary

  activeManagerCount: number
  managerPayments: ManagerPaymentRow[]

  recipientCount: number
  elderCount: number
  childCount: number
  monthlyLogTotal: number
  trend: MonthlyTrendPoint[]

  regions: RegionStat[]

  /** "지금 처리할 일" 액션 큐 — docs/대시보드_재설계.md (Phase 13) */
  actions: ActionQueue
}

// ═════════════════════════════════════════════════════════════
// 필터 (화면 → 데이터 요청)
// ═════════════════════════════════════════════════════════════
export interface LogFilter {
  yearMonth?: YearMonth
  status?: LogStatus
  managerId?: string
}

export interface ManagerFilter {
  keyword?: string
  status?: ManagerStatus
  region?: Region
}

export interface RecipientFilter {
  keyword?: string
  type?: RecipientType
  region?: Region
  /** 🟦 "미배정만 보기" — 기획서 B-4 */
  unassignedOnly?: boolean
  managerId?: string
}

export interface RequestFilter {
  keyword?: string
  status?: RequestStatus
}

export interface DateRange {
  from: ISODate
  to: ISODate
}
