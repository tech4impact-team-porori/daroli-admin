/**
 * 가짜 데이터 — 다로리 관리자 대시보드 (Phase 2)
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  전부 가명 데이터입니다. 실제 대상자·매니저 정보 아님.         │
 * │  금액 집계는 전부 lib/calc.ts 의 함수만 사용합니다.            │
 * └─────────────────────────────────────────────────────────────┘
 *
 * 일부러 불균형하게 만들었습니다:
 *  - 각남면·각북면·이서면·운문면은 매니저가 한 번도 배정된 적 없음
 *  - 풍각면은 매니저가 있지만 아직 activated(applied) 상태라 활동 불가
 *  - 매전면은 매니저가 활동 중 비활성화(퇴사)됨 — 과거 지급 이력은 남음
 *  - 대상자 22명 중 13명이 미배정 상태
 *  - 일부 일지는 GPS 없이 수동 완료(isManual) 처리됨
 *
 * 나중: lib/data/real.ts 가 생기면 lib/data/index.ts 의 db 를 그쪽으로 바꿉니다.
 * 이 파일은 그대로 두고 개발/데모용으로 남겨둡니다.
 */

import {
  ACTIVITY_TYPE,
  LOG_STATUS,
  MANAGER_STATUS,
  PAYOUT_STATUS,
  RECIPIENT_TYPE,
  REQUEST_STATUS,
  REQUEST_TYPE,
  SETTLEMENT_STATUS,
  CHEONGDO_REGIONS,
} from '../status'
import type { PayoutStatus } from '../status'
import {
  calcBalance,
  calcBudgetSummary,
  calcMonthlyBudgetSummary,
  calcSettlementAmount,
  isRegionShortage,
  managerReviewBreakdown,
  needsMonthlyBudgetSetup,
  oldestPendingDays,
  oldestRequestedPayoutDays,
  pendingManagerCount,
  shortageRegions,
  staleRequestCount,
  sumApprovedSettlements,
  sumPaidPayouts,
  unassignedRecipientCount,
  unassignedRecipientsByRegion,
  unpaidManagerCount,
} from '../calc'
import type {
  ActivityLog,
  ActivityLogCard,
  ActivityType,
  CareRequest,
  CareRequestRow,
  DashboardData,
  ISODate,
  ISODateTime,
  LogFilter,
  Manager,
  ManagerFilter,
  ManagerPaymentRow,
  ManagerStatus,
  ManagerWithStats,
  Payout,
  PayoutRow,
  Recipient,
  RecipientFilter,
  RecipientWithManager,
  Region,
  RegionStat,
  RequestFilter,
  Settings,
  Settlement,
  SettlementRow,
  Won,
  YearMonth,
} from '../types'
import type { DataSource } from './index'

// ═════════════════════════════════════════════════════════════
// 기본 도우미
// ═════════════════════════════════════════════════════════════

const pad = (n: number) => String(n).padStart(2, '0')

function iso(y: number, m: number, d: number, h: number, mi: number): ISODateTime {
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}:00+09:00`
}

function isoDate(y: number, m: number, d: number): ISODate {
  return `${y}-${pad(m)}-${pad(d)}`
}

function yearMonthOf(y: number, m: number): YearMonth {
  return `${y}-${pad(m)}`
}

/** 목 API 지연 흉내 — 화면 로딩 상태 확인용 */
function delay(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const CURRENT_ADMIN = { id: 'admin-1', name: '운영 담당자' }

/** 이 목데이터 세트의 "이번 달" 기준. 대시보드/트렌드가 여기까지 채워져 있습니다 */
export const CURRENT_YEAR_MONTH: YearMonth = '2026-08'

const MONTHS: { y: number; m: number; ym: YearMonth }[] = [
  { y: 2026, m: 3, ym: '2026-03' },
  { y: 2026, m: 4, ym: '2026-04' },
  { y: 2026, m: 5, ym: '2026-05' },
  { y: 2026, m: 6, ym: '2026-06' },
  { y: 2026, m: 7, ym: '2026-07' },
  { y: 2026, m: 8, ym: '2026-08' },
]

const REGION_COORDS: Record<Region, { lat: number; lng: number }> = {
  청도읍: { lat: 35.6474, lng: 128.7357 },
  화양읍: { lat: 35.6169, lng: 128.7016 },
  각남면: { lat: 35.573, lng: 128.687 },
  풍각면: { lat: 35.5423, lng: 128.6191 },
  각북면: { lat: 35.7192, lng: 128.6892 },
  이서면: { lat: 35.6667, lng: 128.6333 },
  운문면: { lat: 35.6167, lng: 128.9333 },
  금천면: { lat: 35.5833, lng: 128.7833 },
  매전면: { lat: 35.5667, lng: 128.8167 },
}

const ACTIVITY_TYPES: ActivityType[] = [
  ACTIVITY_TYPE.GENERAL,
  ACTIVITY_TYPE.PICKUP,
  ACTIVITY_TYPE.COMMUNITY,
  ACTIVITY_TYPE.URGENT,
  ACTIVITY_TYPE.OTHER,
]

const CONTENT_POOL = [
  '말벗 및 안부 확인',
  '병원 동행 및 대기',
  '장보기 및 식사 준비 보조',
  '집안 청소 및 정리 지원',
  '목욕 보조 및 위생 관리 지원',
  '주간 안전 확인 방문',
  '행정복지센터 동행',
  '약 복용 확인 및 안내',
]

const NOTE_POOL: (string | undefined)[] = [
  '특이사항 없음',
  '다음 방문 시 보호자 연락 요망',
  '날씨로 인해 방문 시간 조정함',
  undefined,
  undefined,
]

const REJECT_REASON_POOL = [
  '활동 시간 기재 오류로 반려',
  'GPS 기록과 활동 내용이 맞지 않아 반려',
  '참여 인원 수 확인 필요 - 재작성 요청',
  '사진 첨부 누락으로 반려',
]

// ═════════════════════════════════════════════════════════════
// 매니저 7명
// 실제 분포 참고: 청도읍3·화양읍1·풍각면1·금천면1·매전면1
// 각남면·각북면·이서면·운문면은 의도적으로 매니저 0명
// ═════════════════════════════════════════════════════════════

const managers: Manager[] = [
  {
    id: 'mgr-1',
    name: '김○○',
    email: 'manager1@example.com',
    phone: '010-1111-2201',
    homeRegion: '청도읍',
    activityRegions: ['청도읍'],
    hasCar: true,
    status: MANAGER_STATUS.ACTIVE,
    createdAt: iso(2026, 1, 8, 9, 0),
  },
  {
    id: 'mgr-2',
    name: '박○○',
    email: 'manager2@example.com',
    phone: '010-1111-2202',
    homeRegion: '청도읍',
    activityRegions: ['청도읍'],
    hasCar: true,
    status: MANAGER_STATUS.ACTIVE,
    createdAt: iso(2026, 1, 10, 9, 0),
  },
  {
    id: 'mgr-3',
    name: '이○○',
    email: 'manager3@example.com',
    phone: '010-1111-2203',
    homeRegion: '청도읍',
    activityRegions: ['청도읍'],
    hasCar: false,
    status: MANAGER_STATUS.EDUCATED,
    createdAt: iso(2026, 7, 2, 9, 0),
  },
  {
    id: 'mgr-4',
    name: '최○○',
    email: 'manager4@example.com',
    phone: '010-1111-2204',
    homeRegion: '화양읍',
    activityRegions: ['화양읍'],
    hasCar: true,
    status: MANAGER_STATUS.ACTIVE,
    createdAt: iso(2026, 1, 15, 9, 0),
  },
  {
    id: 'mgr-5',
    name: '정○○',
    email: 'manager5@example.com',
    phone: '010-1111-2205',
    homeRegion: '풍각면',
    activityRegions: ['풍각면'],
    hasCar: false,
    status: MANAGER_STATUS.APPLIED,
    createdAt: iso(2026, 8, 3, 9, 0),
  },
  {
    id: 'mgr-6',
    name: '한○○',
    email: 'manager6@example.com',
    phone: '010-1111-2206',
    homeRegion: '금천면',
    activityRegions: ['금천면'],
    hasCar: true,
    status: MANAGER_STATUS.ACTIVE,
    createdAt: iso(2026, 1, 20, 9, 0),
  },
  {
    id: 'mgr-7',
    name: '조○○',
    email: 'manager7@example.com',
    phone: '010-1111-2207',
    homeRegion: '매전면',
    activityRegions: ['매전면'],
    hasCar: true,
    status: MANAGER_STATUS.INACTIVE,
    createdAt: iso(2026, 1, 12, 9, 0),
    deletedAt: iso(2026, 6, 1, 9, 0),
  },
]

// ═════════════════════════════════════════════════════════════
// 대상자 22명 — 9개 읍·면 전체에 분산, 13명 미배정, 2명 삭제 표시
// ═════════════════════════════════════════════════════════════

const recipients: Recipient[] = [
  { id: 'rcp-1', name: '김○○', type: RECIPIENT_TYPE.ELDERLY, region: '청도읍', addressDetail: '청도읍 ○○길 12-3', phone: '010-2222-0001', careNeeds: '고혈압 관리 중', managerId: 'mgr-1', createdAt: iso(2026, 2, 3, 9, 0) },
  { id: 'rcp-2', name: '이○○', type: RECIPIENT_TYPE.ELDERLY, region: '청도읍', addressDetail: '청도읍 ○○길 45', phone: '010-2222-0002', managerId: 'mgr-1', createdAt: iso(2026, 2, 4, 9, 0) },
  { id: 'rcp-3', name: '박○○', type: RECIPIENT_TYPE.ELDERLY, region: '청도읍', addressDetail: '청도읍 ○○로 8', careNeeds: '거동 약간 불편, 지팡이 사용', managerId: 'mgr-2', createdAt: iso(2026, 2, 5, 9, 0) },
  { id: 'rcp-4', name: '최○○', type: RECIPIENT_TYPE.CHILD, age: 9, region: '청도읍', addressDetail: '청도읍 ○○로 21', phone: '010-2222-0004', managerId: 'mgr-2', createdAt: iso(2026, 2, 20, 9, 0) },
  { id: 'rcp-5', name: '정○○', type: RECIPIENT_TYPE.ELDERLY, region: '청도읍', addressDetail: '청도읍 ○○길 3', createdAt: iso(2026, 3, 1, 9, 0), deletedAt: iso(2026, 7, 10, 9, 0) },
  { id: 'rcp-6', name: '조○○', type: RECIPIENT_TYPE.ELDERLY, region: '화양읍', addressDetail: '화양읍 ○○길 9', phone: '010-2222-0006', careNeeds: '당뇨 관리 중', managerId: 'mgr-4', createdAt: iso(2026, 2, 8, 9, 0) },
  { id: 'rcp-7', name: '윤○○', type: RECIPIENT_TYPE.ELDERLY, region: '화양읍', addressDetail: '화양읍 ○○로 14', createdAt: iso(2026, 3, 12, 9, 0) },
  { id: 'rcp-8', name: '장○○', type: RECIPIENT_TYPE.ELDERLY, region: '풍각면', addressDetail: '풍각면 ○○길 5', phone: '010-2222-0008', createdAt: iso(2026, 4, 2, 9, 0) },
  { id: 'rcp-9', name: '임○○', type: RECIPIENT_TYPE.CHILD, age: 7, region: '풍각면', addressDetail: '풍각면 ○○로 2', createdAt: iso(2026, 4, 5, 9, 0) },
  { id: 'rcp-10', name: '한○○', type: RECIPIENT_TYPE.ELDERLY, region: '금천면', addressDetail: '금천면 ○○길 11', phone: '010-2222-0010', careNeeds: '낙상 위험 - 보행 보조 필요', managerId: 'mgr-6', createdAt: iso(2026, 2, 10, 9, 0) },
  { id: 'rcp-11', name: '오○○', type: RECIPIENT_TYPE.ELDERLY, region: '금천면', addressDetail: '금천면 ○○로 6', managerId: 'mgr-6', createdAt: iso(2026, 2, 11, 9, 0) },
  { id: 'rcp-12', name: '서○○', type: RECIPIENT_TYPE.CHILD, age: 10, region: '금천면', addressDetail: '금천면 ○○길 19', phone: '010-2222-0012', managerId: 'mgr-6', createdAt: iso(2026, 3, 2, 9, 0) },
  { id: 'rcp-13', name: '신○○', type: RECIPIENT_TYPE.ELDERLY, region: '금천면', addressDetail: '금천면 ○○로 3', createdAt: iso(2026, 5, 1, 9, 0) },
  { id: 'rcp-14', name: '권○○', type: RECIPIENT_TYPE.ELDERLY, region: '매전면', addressDetail: '매전면 ○○길 7', phone: '010-2222-0014', careNeeds: '만성 관절염', managerId: 'mgr-7', createdAt: iso(2026, 1, 25, 9, 0) },
  { id: 'rcp-15', name: '황○○', type: RECIPIENT_TYPE.ELDERLY, region: '매전면', addressDetail: '매전면 ○○로 4', createdAt: iso(2026, 3, 20, 9, 0), deletedAt: iso(2026, 7, 15, 9, 0) },
  { id: 'rcp-16', name: '남○○', type: RECIPIENT_TYPE.ELDERLY, region: '각남면', addressDetail: '각남면 ○○길 2', phone: '010-2222-0016', createdAt: iso(2026, 4, 10, 9, 0) },
  { id: 'rcp-17', name: '방○○', type: RECIPIENT_TYPE.CHILD, age: 8, region: '각남면', addressDetail: '각남면 ○○로 10', createdAt: iso(2026, 4, 11, 9, 0) },
  { id: 'rcp-18', name: '유○○', type: RECIPIENT_TYPE.ELDERLY, region: '각남면', addressDetail: '각남면 ○○길 33', createdAt: iso(2026, 4, 12, 9, 0) },
  { id: 'rcp-19', name: '배○○', type: RECIPIENT_TYPE.ELDERLY, region: '각북면', addressDetail: '각북면 ○○길 6', phone: '010-2222-0019', createdAt: iso(2026, 5, 3, 9, 0) },
  { id: 'rcp-20', name: '홍○○', type: RECIPIENT_TYPE.ELDERLY, region: '각북면', addressDetail: '각북면 ○○로 1', createdAt: iso(2026, 5, 4, 9, 0) },
  { id: 'rcp-21', name: '문○○', type: RECIPIENT_TYPE.ELDERLY, region: '운문면', addressDetail: '운문면 ○○길 15', phone: '010-2222-0021', createdAt: iso(2026, 5, 20, 9, 0) },
  { id: 'rcp-22', name: '구○○', type: RECIPIENT_TYPE.CHILD, age: 12, region: '운문면', addressDetail: '운문면 ○○로 8', createdAt: iso(2026, 5, 21, 9, 0) },
]

// ═════════════════════════════════════════════════════════════
// 돌봄 요청 15건 — 5개 상태 골고루, 미배정 지역 포함
// ═════════════════════════════════════════════════════════════

const requests: CareRequest[] = [
  { id: 'req-1', recipientId: 'rcp-1', managerId: 'mgr-1', requestType: REQUEST_TYPE.HOSPITAL_RIDE, desiredAt: iso(2026, 8, 5, 9, 0), isTimeFixed: true, status: REQUEST_STATUS.COMPLETED, confirmedAt: iso(2026, 8, 5, 9, 0), createdAt: iso(2026, 8, 1, 9, 0) },
  { id: 'req-2', recipientId: 'rcp-2', managerId: 'mgr-1', requestType: REQUEST_TYPE.HOME_HELP, desiredAt: iso(2026, 8, 14, 10, 0), isTimeFixed: false, status: REQUEST_STATUS.CONFIRMED, confirmedAt: iso(2026, 8, 14, 10, 0), createdAt: iso(2026, 8, 10, 9, 0) },
  { id: 'req-3', recipientId: 'rcp-3', requestType: REQUEST_TYPE.MEAL_SUPPORT, desiredAt: iso(2026, 8, 16, 11, 30), isTimeFixed: false, status: REQUEST_STATUS.REQUESTED, createdAt: iso(2026, 8, 12, 9, 0) },
  { id: 'req-4', recipientId: 'rcp-4', managerId: 'mgr-2', requestType: REQUEST_TYPE.COMPANIONSHIP, desiredAt: iso(2026, 8, 15, 14, 0), isTimeFixed: false, status: REQUEST_STATUS.PROPOSED, proposedAt: iso(2026, 8, 15, 15, 0), createdAt: iso(2026, 8, 11, 9, 0) },
  { id: 'req-5', recipientId: 'rcp-5', requestType: REQUEST_TYPE.OTHER, desiredAt: iso(2026, 8, 17, 9, 0), isTimeFixed: false, note: '미배정 지역 요청 - 배정 필요', status: REQUEST_STATUS.REQUESTED, createdAt: iso(2026, 8, 13, 9, 0) },
  { id: 'req-6', recipientId: 'rcp-6', managerId: 'mgr-4', requestType: REQUEST_TYPE.HOSPITAL_RIDE, desiredAt: iso(2026, 8, 10, 8, 30), isTimeFixed: true, status: REQUEST_STATUS.COMPLETED, confirmedAt: iso(2026, 8, 10, 8, 30), createdAt: iso(2026, 8, 6, 9, 0) },
  { id: 'req-7', recipientId: 'rcp-7', requestType: REQUEST_TYPE.HOME_HELP, desiredAt: iso(2026, 8, 12, 13, 0), isTimeFixed: false, note: '요청자 단순 변심으로 취소', status: REQUEST_STATUS.CANCELLED, createdAt: iso(2026, 8, 8, 9, 0) },
  { id: 'req-8', recipientId: 'rcp-8', requestType: REQUEST_TYPE.MEAL_SUPPORT, desiredAt: iso(2026, 8, 18, 12, 0), isTimeFixed: false, status: REQUEST_STATUS.REQUESTED, createdAt: iso(2026, 8, 14, 9, 0) },
  { id: 'req-9', recipientId: 'rcp-9', requestType: REQUEST_TYPE.COMPANIONSHIP, desiredAt: iso(2026, 8, 19, 15, 0), isTimeFixed: false, status: REQUEST_STATUS.REQUESTED, createdAt: iso(2026, 8, 14, 9, 0) },
  { id: 'req-10', recipientId: 'rcp-10', managerId: 'mgr-6', requestType: REQUEST_TYPE.HOSPITAL_RIDE, desiredAt: iso(2026, 8, 14, 9, 0), isTimeFixed: true, status: REQUEST_STATUS.CONFIRMED, confirmedAt: iso(2026, 8, 14, 9, 0), createdAt: iso(2026, 8, 9, 9, 0) },
  { id: 'req-11', recipientId: 'rcp-11', managerId: 'mgr-6', requestType: REQUEST_TYPE.HOME_HELP, desiredAt: iso(2026, 8, 7, 10, 0), isTimeFixed: false, status: REQUEST_STATUS.COMPLETED, confirmedAt: iso(2026, 8, 7, 10, 0), createdAt: iso(2026, 8, 3, 9, 0) },
  { id: 'req-12', recipientId: 'rcp-13', requestType: REQUEST_TYPE.OTHER, desiredAt: iso(2026, 8, 20, 9, 30), isTimeFixed: false, status: REQUEST_STATUS.REQUESTED, createdAt: iso(2026, 8, 15, 9, 0) },
  { id: 'req-13', recipientId: 'rcp-14', requestType: REQUEST_TYPE.MEAL_SUPPORT, desiredAt: iso(2026, 8, 21, 11, 0), isTimeFixed: false, note: '담당 매니저 비활성화로 재배정 필요', status: REQUEST_STATUS.REQUESTED, createdAt: iso(2026, 8, 15, 9, 0) },
  { id: 'req-14', recipientId: 'rcp-16', requestType: REQUEST_TYPE.HOSPITAL_RIDE, desiredAt: iso(2026, 8, 21, 8, 0), isTimeFixed: true, status: REQUEST_STATUS.REQUESTED, createdAt: iso(2026, 8, 15, 9, 0) },
  { id: 'req-15', recipientId: 'rcp-21', requestType: REQUEST_TYPE.COMPANIONSHIP, desiredAt: iso(2026, 8, 22, 10, 0), isTimeFixed: false, status: REQUEST_STATUS.REQUESTED, createdAt: iso(2026, 8, 15, 9, 0) },
]

// ═════════════════════════════════════════════════════════════
// 활동일지 — active 매니저만 (mgr-1,2,4,6 전체 기간 / mgr-7 3~5월만)
// ═════════════════════════════════════════════════════════════

const LOG_MANAGER_PLAN: { managerId: string; perMonth: number[] }[] = [
  { managerId: 'mgr-1', perMonth: [2, 2, 2, 3, 2, 3] },
  { managerId: 'mgr-2', perMonth: [2, 2, 2, 2, 2, 2] },
  { managerId: 'mgr-4', perMonth: [1, 2, 2, 2, 2, 1] },
  { managerId: 'mgr-6', perMonth: [2, 2, 2, 2, 2, 1] },
  { managerId: 'mgr-7', perMonth: [3, 3, 2, 0, 0, 0] },
]

function buildLogs(): ActivityLog[] {
  const logs: ActivityLog[] = []
  let globalIndex = 0

  for (const plan of LOG_MANAGER_PLAN) {
    const manager = managers.find((m) => m.id === plan.managerId)!
    const assigned = recipients.filter((r) => r.managerId === manager.id && !r.deletedAt)
    const pool = assigned.length > 0
      ? assigned
      : recipients.filter((r) => r.region === manager.homeRegion && !r.deletedAt)

    plan.perMonth.forEach((count, monthIdx) => {
      const { y, m } = MONTHS[monthIdx]
      for (let k = 0; k < count; k++) {
        const recipient = pool[(k + monthIdx) % pool.length]
        const day = 3 + ((k * 6 + monthIdx * 4) % 24)
        const startHour = 9 + (globalIndex % 6)
        const activityType = ACTIVITY_TYPES[globalIndex % ACTIVITY_TYPES.length]
        const isManual = globalIndex % 7 === 0
        const statusPick = globalIndex % 8
        const status =
          statusPick === 5 ? LOG_STATUS.REJECTED : statusPick === 3 ? LOG_STATUS.PENDING : LOG_STATUS.APPROVED

        const startedAt = iso(y, m, day, startHour, 0)
        const endedAt = iso(y, m, day, startHour + 1, 30)
        const coord = REGION_COORDS[recipient.region]
        const jitter = ((globalIndex % 5) - 2) * 0.001

        const photoCount = globalIndex % 3
        const photos = Array.from({ length: photoCount }, (_, i) => ({
          id: `photo-${globalIndex}-${i}`,
          url: `https://placehold.co/400x300?text=Photo+${globalIndex}-${i}`,
        }))

        logs.push({
          id: `log-${++globalIndex}`,
          managerId: manager.id,
          recipientId: recipient.id,
          activityDate: isoDate(y, m, day),
          startedAt,
          endedAt,
          activityType,
          place: `${recipient.region} 자택`,
          participantCount: 1 + (globalIndex % 3),
          content: CONTENT_POOL[globalIndex % CONTENT_POOL.length],
          note: NOTE_POOL[globalIndex % NOTE_POOL.length],
          gpsStart: isManual ? undefined : { lat: coord.lat + jitter, lng: coord.lng + jitter, at: startedAt },
          gpsEnd: isManual ? undefined : { lat: coord.lat + jitter, lng: coord.lng + jitter, at: endedAt },
          gpsDistance: isManual ? undefined : 20 + (globalIndex % 15) * 12,
          isManual,
          status,
          rejectReason: status === LOG_STATUS.REJECTED ? REJECT_REASON_POOL[globalIndex % REJECT_REASON_POOL.length] : undefined,
          reviewedBy: status === LOG_STATUS.PENDING ? undefined : CURRENT_ADMIN.id,
          reviewedAt: status === LOG_STATUS.PENDING ? undefined : iso(y, m, day, 18, 0),
          photos,
          createdAt: endedAt,
        })
      }
    })
  }

  return logs
}

const activityLogs: ActivityLog[] = buildLogs()

// ═════════════════════════════════════════════════════════════
// 월별 정산 — 승인된 일지를 (매니저, 월) 로 묶어서 산출
// 이번 달(CURRENT_YEAR_MONTH)만 미승인(calculated) 상태로 남겨둠
// ═════════════════════════════════════════════════════════════

function buildSettlements(unitPrice: Won): Settlement[] {
  const grouped = new Map<string, { managerId: string; yearMonth: YearMonth; count: number }>()

  for (const log of activityLogs) {
    if (log.status !== LOG_STATUS.APPROVED) continue
    const yearMonth = log.activityDate.slice(0, 7)
    const key = `${log.managerId}__${yearMonth}`
    const existing = grouped.get(key)
    if (existing) {
      existing.count += 1
    } else {
      grouped.set(key, { managerId: log.managerId, yearMonth, count: 1 })
    }
  }

  let seq = 0
  return Array.from(grouped.values()).map(({ managerId, yearMonth, count }) => {
    const isCurrentMonth = yearMonth === CURRENT_YEAR_MONTH
    const amount = calcSettlementAmount(count, unitPrice)
    return {
      id: `stl-${++seq}`,
      managerId,
      yearMonth,
      logCount: count,
      unitPrice,
      amount,
      status: isCurrentMonth ? SETTLEMENT_STATUS.CALCULATED : SETTLEMENT_STATUS.APPROVED,
      approvedBy: isCurrentMonth ? undefined : CURRENT_ADMIN.id,
      approvedAt: isCurrentMonth ? undefined : iso(Number(yearMonth.slice(0, 4)), Number(yearMonth.slice(5, 7)) + 1, 1, 10, 0),
      createdAt: iso(Number(yearMonth.slice(0, 4)), Number(yearMonth.slice(5, 7)), 28, 18, 0),
    } satisfies Settlement
  })
}

const UNIT_PRICE = 25000

const settlements: Settlement[] = buildSettlements(UNIT_PRICE)

// ═════════════════════════════════════════════════════════════
// 출금 — 매니저별 승인 정산 총액의 일부만 신청/지급 (잔액 항상 0 이상 유지)
// ═════════════════════════════════════════════════════════════

function buildPayouts(): Payout[] {
  const payouts: Payout[] = []
  let seq = 0

  for (const manager of managers) {
    const approvedTotal = sumApprovedSettlements(settlements.filter((s) => s.managerId === manager.id))
    if (approvedTotal <= 0) continue

    if (manager.status === MANAGER_STATUS.INACTIVE) {
      // 퇴사한 매니저 — 정산은 이미 전액 지급 완료, 잔액 0
      payouts.push({
        id: `pay-${++seq}`,
        managerId: manager.id,
        amount: approvedTotal,
        status: PAYOUT_STATUS.PAID,
        processedBy: CURRENT_ADMIN.id,
        processedAt: iso(2026, 6, 5, 10, 0),
        createdAt: iso(2026, 6, 3, 9, 0),
      })
      continue
    }

    const paidAmount = Math.floor((approvedTotal * 0.6) / 1000) * 1000
    const requestedAmount = Math.floor((approvedTotal * 0.15) / 1000) * 1000

    if (paidAmount > 0) {
      payouts.push({
        id: `pay-${++seq}`,
        managerId: manager.id,
        amount: paidAmount,
        status: PAYOUT_STATUS.PAID,
        processedBy: CURRENT_ADMIN.id,
        processedAt: iso(2026, 7, 5, 10, 0),
        createdAt: iso(2026, 7, 2, 9, 0),
      })
    }
    if (requestedAmount > 0) {
      payouts.push({
        id: `pay-${++seq}`,
        managerId: manager.id,
        amount: requestedAmount,
        status: PAYOUT_STATUS.REQUESTED,
        createdAt: iso(2026, 8, 10, 9, 0),
      })
    }
  }

  // 반려 사례 하나 — 반려 금액은 잔액에 영향 없음을 보여주기 위함
  const rejectTarget = managers.find((m) => m.id === 'mgr-2')
  if (rejectTarget) {
    payouts.push({
      id: `pay-${++seq}`,
      managerId: rejectTarget.id,
      amount: 50000,
      status: PAYOUT_STATUS.REJECTED,
      rejectReason: '신청 금액이 정산 단가와 맞지 않아 반려. 재신청 요청',
      processedBy: CURRENT_ADMIN.id,
      processedAt: iso(2026, 8, 8, 11, 0),
      createdAt: iso(2026, 8, 7, 9, 0),
    })
  }

  return payouts
}

const payouts: Payout[] = buildPayouts()

// ═════════════════════════════════════════════════════════════
// 시스템 설정
// ═════════════════════════════════════════════════════════════

let settings: Settings = {
  unitPrice: UNIT_PRICE,
  totalBudget: 200_000_000,
  monthlyBudget: 18_000_000,
  regionShortageThreshold: 3,
  updatedAt: iso(2026, 8, 1, 9, 0),
}

// ═════════════════════════════════════════════════════════════
// 조회 도우미
// ═════════════════════════════════════════════════════════════

function findManager(id: string): Manager | undefined {
  return managers.find((m) => m.id === id)
}

function findRecipient(id: string): Recipient | undefined {
  return recipients.find((r) => r.id === id)
}

function managerStats(manager: Manager): Omit<ManagerWithStats, keyof Manager> {
  const own = settlements.filter((s) => s.managerId === manager.id)
  const ownPayouts = payouts.filter((p) => p.managerId === manager.id)
  const monthlyLogCount = activityLogs.filter(
    (l) => l.managerId === manager.id && l.status === LOG_STATUS.APPROVED && l.activityDate.startsWith(CURRENT_YEAR_MONTH),
  ).length
  const totalLogCount = activityLogs.filter((l) => l.managerId === manager.id).length
  const recipientCount = recipients.filter((r) => r.managerId === manager.id && !r.deletedAt).length

  return {
    recipientCount,
    monthlyLogCount,
    totalLogCount,
    approvedTotal: sumApprovedSettlements(own),
    paidTotal: sumPaidPayouts(ownPayouts),
    balance: calcBalance(own, ownPayouts),
  }
}

function toManagerWithStats(manager: Manager): ManagerWithStats {
  return { ...manager, ...managerStats(manager) }
}

function toActivityLogCard(log: ActivityLog): ActivityLogCard {
  const manager = findManager(log.managerId)
  const recipient = findRecipient(log.recipientId)!
  return {
    ...log,
    managerName: manager?.name ?? '(알 수 없음)',
    recipientName: recipient.name,
    recipientType: recipient.type,
    region: recipient.region,
  }
}

function toCareRequestRow(request: CareRequest): CareRequestRow {
  const recipient = findRecipient(request.recipientId)!
  const manager = request.managerId ? findManager(request.managerId) : undefined
  return {
    ...request,
    recipientName: recipient.name,
    managerName: manager?.name,
    region: recipient.region,
  }
}

function toRecipientWithManager(recipient: Recipient): RecipientWithManager {
  const manager = recipient.managerId ? findManager(recipient.managerId) : undefined
  return {
    ...recipient,
    manager: manager ? { id: manager.id, name: manager.name, status: manager.status } : undefined,
  }
}

function toSettlementRow(settlement: Settlement): SettlementRow {
  const manager = findManager(settlement.managerId)
  return { ...settlement, managerName: manager?.name ?? '(알 수 없음)' }
}

function toPayoutRow(payout: Payout): PayoutRow {
  const manager = findManager(payout.managerId)
  return { ...payout, managerName: manager?.name ?? '(알 수 없음)' }
}

function computeRegionStats(yearMonth: YearMonth): RegionStat[] {
  return CHEONGDO_REGIONS.map((region) => {
    const regionRecipients = recipients.filter((r) => r.region === region && !r.deletedAt)
    const recipientCount = regionRecipients.length
    const activeManagerCount = managers.filter(
      (m) => m.homeRegion === region && m.status === MANAGER_STATUS.ACTIVE,
    ).length
    const assignedManagerCount = new Set(
      regionRecipients.map((r) => r.managerId).filter((id): id is string => Boolean(id)),
    ).size
    const monthlyLogCount = activityLogs.filter((l) => {
      if (!l.activityDate.startsWith(yearMonth)) return false
      const recipient = findRecipient(l.recipientId)
      return recipient?.region === region
    }).length

    return {
      region,
      recipientCount,
      activeManagerCount,
      assignedManagerCount,
      monthlyLogCount,
      isShortage: isRegionShortage(recipientCount, activeManagerCount, settings.regionShortageThreshold),
    }
  })
}

function lastNMonths(yearMonth: YearMonth, n: number): YearMonth[] {
  const [y, m] = yearMonth.split('-').map(Number)
  const out: YearMonth[] = []
  for (let i = n - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i
    const yy = Math.floor(total / 12)
    const mm = (total % 12) + 1
    out.push(yearMonthOf(yy, mm))
  }
  return out
}

// ═════════════════════════════════════════════════════════════
// DataSource 구현
// ═════════════════════════════════════════════════════════════

export const mockDataSource: DataSource = {
  async getDashboard(yearMonth) {
    await delay()

    const budget = calcBudgetSummary(settings, settlements, payouts, activityLogs)
    const monthlyBudget = calcMonthlyBudgetSummary(yearMonth, settings, settlements, activityLogs)
    const regions = computeRegionStats(yearMonth)

    const managerPayments: ManagerPaymentRow[] = managers
      .map((m) => {
        const stats = managerStats(m)
        return {
          managerId: m.id,
          managerName: m.name,
          isRetired: m.status === MANAGER_STATUS.INACTIVE || Boolean(m.deletedAt),
          monthlyLogCount: stats.monthlyLogCount,
          approvedTotal: stats.approvedTotal,
          paidTotal: stats.paidTotal,
          balance: stats.balance,
        }
      })
      .sort((a, b) => b.approvedTotal - a.approvedTotal)

    const activeRecipients = recipients.filter((r) => !r.deletedAt)
    const trend = lastNMonths(yearMonth, 6).map((ym) => ({
      yearMonth: ym,
      submitted: activityLogs.filter((l) => l.activityDate.startsWith(ym)).length,
      approved: activityLogs.filter((l) => l.activityDate.startsWith(ym) && l.status === LOG_STATUS.APPROVED).length,
    }))

    const pendingLogCount = activityLogs.filter((l) => l.status === LOG_STATUS.PENDING).length
    const reviewBreakdown = managerReviewBreakdown(managers)
    const now = new Date()

    const data: DashboardData = {
      pendingLogCount,
      budget,
      monthlyBudget,
      activeManagerCount: managers.filter((m) => m.status === MANAGER_STATUS.ACTIVE).length,
      managerPayments,
      recipientCount: activeRecipients.length,
      elderCount: activeRecipients.filter((r) => r.type === RECIPIENT_TYPE.ELDERLY).length,
      childCount: activeRecipients.filter((r) => r.type === RECIPIENT_TYPE.CHILD).length,
      monthlyLogTotal: activityLogs.filter((l) => l.activityDate.startsWith(yearMonth)).length,
      trend,
      regions,
      actions: {
        approvedUnpaid: budget.approvedUnpaid,
        requestedPayoutCount: payouts.filter((p) => p.status === PAYOUT_STATUS.REQUESTED).length,
        pendingLogCount,
        oldestPendingDays: oldestPendingDays(activityLogs, now),
        staleRequestCount: staleRequestCount(requests, now),
        pendingManagerCount: pendingManagerCount(managers),
        unassignedRecipientCount: unassignedRecipientCount(recipients),
        shortageRegions: shortageRegions(regions),
        needsBudgetSetup: needsMonthlyBudgetSetup(settings),
        unpaidManagerCount: unpaidManagerCount(managers, settlements, payouts),
        oldestRequestedPayoutDays: oldestRequestedPayoutDays(payouts, now),
        appliedManagerCount: reviewBreakdown.applied,
        educatedManagerCount: reviewBreakdown.educated,
        unassignedByRegion: unassignedRecipientsByRegion(recipients),
        budgetSetupMonth: yearMonth,
      },
    }
    return data
  },

  async getRegionStats(yearMonth) {
    await delay()
    return computeRegionStats(yearMonth)
  },

  async listLogs(filter: LogFilter) {
    await delay()
    return activityLogs
      .filter((l) => (filter.yearMonth ? l.activityDate.startsWith(filter.yearMonth) : true))
      .filter((l) => (filter.status ? l.status === filter.status : true))
      .filter((l) => (filter.managerId ? l.managerId === filter.managerId : true))
      .map(toActivityLogCard)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async approveLog(id) {
    await delay()
    const log = activityLogs.find((l) => l.id === id)
    if (!log) throw new Error(`[mock] 일지를 찾을 수 없습니다: ${id}`)
    log.status = LOG_STATUS.APPROVED
    log.rejectReason = undefined
    log.reviewedBy = CURRENT_ADMIN.id
    log.reviewedAt = new Date().toISOString()
  },

  async rejectLog(id, reason) {
    await delay()
    if (!reason) throw new Error('[mock] 반려 사유는 필수입니다')
    const log = activityLogs.find((l) => l.id === id)
    if (!log) throw new Error(`[mock] 일지를 찾을 수 없습니다: ${id}`)
    log.status = LOG_STATUS.REJECTED
    log.rejectReason = reason
    log.reviewedBy = CURRENT_ADMIN.id
    log.reviewedAt = new Date().toISOString()
  },

  async generateSettlements(yearMonth) {
    await delay()
    const approvedCountByManager = new Map<string, number>()
    for (const log of activityLogs) {
      if (log.status !== LOG_STATUS.APPROVED) continue
      if (!log.activityDate.startsWith(yearMonth)) continue
      approvedCountByManager.set(log.managerId, (approvedCountByManager.get(log.managerId) ?? 0) + 1)
    }

    for (const [managerId, count] of approvedCountByManager) {
      const existing = settlements.find((s) => s.managerId === managerId && s.yearMonth === yearMonth)
      // 재산정은 미승인 건만 갱신. 이미 승인된 건은 건드리지 않는다
      if (existing && existing.status === SETTLEMENT_STATUS.APPROVED) continue

      const amount = calcSettlementAmount(count, settings.unitPrice)
      if (existing) {
        existing.logCount = count
        existing.unitPrice = settings.unitPrice
        existing.amount = amount
      } else {
        settlements.push({
          id: `stl-${settlements.length + 1}-${managerId}`,
          managerId,
          yearMonth,
          logCount: count,
          unitPrice: settings.unitPrice,
          amount,
          status: SETTLEMENT_STATUS.CALCULATED,
          createdAt: new Date().toISOString(),
        })
      }
    }
  },

  async listSettlements(yearMonth) {
    await delay()
    return settlements.filter((s) => s.yearMonth === yearMonth).map(toSettlementRow)
  },

  async approveSettlement(id) {
    await delay()
    const settlement = settlements.find((s) => s.id === id)
    if (!settlement) throw new Error(`[mock] 정산을 찾을 수 없습니다: ${id}`)
    settlement.status = SETTLEMENT_STATUS.APPROVED
    settlement.approvedBy = CURRENT_ADMIN.id
    settlement.approvedAt = new Date().toISOString()
  },

  async cancelSettlementApproval(id) {
    await delay()
    const settlement = settlements.find((s) => s.id === id)
    if (!settlement) throw new Error(`[mock] 정산을 찾을 수 없습니다: ${id}`)
    const managerSettlements = settlements.filter((s) => s.managerId === settlement.managerId)
    const managerPayouts = payouts.filter((p) => p.managerId === settlement.managerId)
    const currentBalance = calcBalance(managerSettlements, managerPayouts)
    if (currentBalance - settlement.amount < 0) {
      throw new Error('[mock] 잔액이 음수가 되어 승인 취소할 수 없습니다')
    }
    settlement.status = SETTLEMENT_STATUS.CALCULATED
    settlement.approvedBy = undefined
    settlement.approvedAt = undefined
  },

  async listPayouts(status?: PayoutStatus) {
    await delay()
    return payouts
      .filter((p) => (status ? p.status === status : true))
      .map(toPayoutRow)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async markPayoutPaid(id) {
    await delay()
    const payout = payouts.find((p) => p.id === id)
    if (!payout) throw new Error(`[mock] 출금 신청을 찾을 수 없습니다: ${id}`)
    payout.status = PAYOUT_STATUS.PAID
    payout.processedBy = CURRENT_ADMIN.id
    payout.processedAt = new Date().toISOString()
  },

  async rejectPayout(id, reason) {
    await delay()
    if (!reason) throw new Error('[mock] 반려 사유는 필수입니다')
    const payout = payouts.find((p) => p.id === id)
    if (!payout) throw new Error(`[mock] 출금 신청을 찾을 수 없습니다: ${id}`)
    payout.status = PAYOUT_STATUS.REJECTED
    payout.rejectReason = reason
    payout.processedBy = CURRENT_ADMIN.id
    payout.processedAt = new Date().toISOString()
  },

  async listManagers(filter: ManagerFilter) {
    await delay()
    const keyword = filter.keyword?.trim().toLowerCase()
    return managers
      .filter((m) => (filter.status ? m.status === filter.status : true))
      .filter((m) => (filter.region ? m.homeRegion === filter.region || m.activityRegions.includes(filter.region) : true))
      .filter((m) =>
        keyword
          ? m.name.toLowerCase().includes(keyword) ||
            m.email.toLowerCase().includes(keyword) ||
            m.phone.includes(keyword)
          : true,
      )
      .map(toManagerWithStats)
  },

  async getManager(id) {
    await delay()
    const manager = findManager(id)
    return manager ? toManagerWithStats(manager) : null
  },

  async updateManagerStatus(id, status: ManagerStatus) {
    await delay()
    const manager = findManager(id)
    if (!manager) throw new Error(`[mock] 매니저를 찾을 수 없습니다: ${id}`)
    manager.status = status
  },

  async updateManager(id, patch) {
    await delay()
    const manager = findManager(id)
    if (!manager) throw new Error(`[mock] 매니저를 찾을 수 없습니다: ${id}`)
    Object.assign(manager, patch)
  },

  async listRecipients(filter: RecipientFilter) {
    await delay()
    const keyword = filter.keyword?.trim().toLowerCase()
    return recipients
      .filter((r) => (filter.type ? r.type === filter.type : true))
      .filter((r) => (filter.region ? r.region === filter.region : true))
      .filter((r) => (filter.managerId ? r.managerId === filter.managerId : true))
      .filter((r) => (filter.unassignedOnly ? !r.managerId : true))
      .filter((r) => (keyword ? r.name.toLowerCase().includes(keyword) : true))
      .map(toRecipientWithManager)
  },

  async createRecipient(input) {
    await delay()
    const id = `rcp-${recipients.length + 1}`
    recipients.push({ ...input, id, createdAt: new Date().toISOString() })
    return id
  },

  async updateRecipient(id, patch) {
    await delay()
    const recipient = findRecipient(id)
    if (!recipient) throw new Error(`[mock] 대상자를 찾을 수 없습니다: ${id}`)
    Object.assign(recipient, patch)
  },

  async deleteRecipient(id) {
    await delay()
    const recipient = findRecipient(id)
    if (!recipient) throw new Error(`[mock] 대상자를 찾을 수 없습니다: ${id}`)
    recipient.deletedAt = new Date().toISOString()
  },

  async listRequests(filter: RequestFilter) {
    await delay()
    const keyword = filter.keyword?.trim().toLowerCase()
    return requests
      .filter((r) => (filter.status ? r.status === filter.status : true))
      .map(toCareRequestRow)
      .filter((r) =>
        keyword
          ? r.recipientName.toLowerCase().includes(keyword) ||
            (r.managerName?.toLowerCase().includes(keyword) ?? false) ||
            (r.note?.toLowerCase().includes(keyword) ?? false)
          : true,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async getSettings() {
    await delay()
    return settings
  },

  async updateSettings(patch) {
    await delay()
    settings = { ...settings, ...patch, updatedAt: new Date().toISOString() }
  },
}
