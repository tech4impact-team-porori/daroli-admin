/**
 * 상태값 정의 — 다로리 관리자 대시보드
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  이 파일이 이 프로젝트에서 가장 중요한 파일입니다.            │
 * │  백엔드 값이 확정되면 "여기만" 고치면 됩니다.                 │
 * │  화면 코드에는 절대 문자열을 직접 쓰지 마세요.                │
 * │    ❌  if (log.status === 'pending')                         │
 * │    ✅  if (log.status === LOG_STATUS.PENDING)                │
 * └─────────────────────────────────────────────────────────────┘
 *
 * 표기
 *   🟦 확정 — 앱 기획서 Ver 1.0 원문에 영문으로 명시됨. 바꾸지 말 것
 *   🟨 임시 — 백엔드 담당자 확답 전. 값이 다르면 이 파일만 교체
 *
 * 백엔드 확답이 오면:
 *   1) 값이 같다  → @backend-confirmed 로 주석만 바꾸고 끝
 *   2) 값이 다르다 → 아래 문자열만 교체. 화면 코드는 손대지 않음
 *   3) 도저히 못 맞추겠다 → lib/data/real.ts 에서 변환 (마지막 수단)
 */

// ─────────────────────────────────────────────────────────────
// 매니저 자격 상태
// 🟦 applied / educated / active — 기획서 A-2, B-5 명시
// 🟨 inactive — 기획서엔 "비활성"만 있고 영문값 없음
// ─────────────────────────────────────────────────────────────
export const MANAGER_STATUS = {
  /** 🟦 지원 접수됨 — 관리자 심사 대기 */
  APPLIED: 'applied',
  /** 🟦 교육 이수 확인됨 — 활동 승인 대기 */
  EDUCATED: 'educated',
  /** 🟦 활동 가능 — 이 상태부터만 요청 배정·일지 작성 가능 */
  ACTIVE: 'active',
  /** 🟨 비활성 — 영문값 미확정 */
  INACTIVE: 'inactive',
} as const

// ─────────────────────────────────────────────────────────────
// 돌봄 요청 상태
// 🟦 전부 기획서 B-2 원문 명시
// ─────────────────────────────────────────────────────────────
export const REQUEST_STATUS = {
  /** 🟦 접수됨 — 배정 매니저에게 노출 */
  REQUESTED: 'requested',
  /** 🟦 시간 제안됨 — 요청자 확정 대기 */
  PROPOSED: 'proposed',
  /** 🟦 확정 */
  CONFIRMED: 'confirmed',
  /** 🟦 완료 */
  COMPLETED: 'completed',
  /** 🟦 취소 */
  CANCELLED: 'cancelled',
} as const

// ─────────────────────────────────────────────────────────────
// 활동일지 상태
// 🟨 전부 임시. 기획서엔 한글(검토 대기/승인/반려)만 있음
//    단 'pending' 은 기획서 B-6 재산정 규칙에 등장 → 가능성 높음
// ─────────────────────────────────────────────────────────────
export const LOG_STATUS = {
  /** 🟨 검토 대기 */
  PENDING: 'pending',
  /** 🟨 승인 — 이 상태만 월별 정산 산정에 포함 */
  APPROVED: 'approved',
  /** 🟨 반려 — 사유 필수 */
  REJECTED: 'rejected',
} as const

// ─────────────────────────────────────────────────────────────
// 출금 신청 상태
// 🟨 전부 임시
// ─────────────────────────────────────────────────────────────
export const PAYOUT_STATUS = {
  /** 🟨 신청 중 — 잔액에서 이미 차감된 상태로 계산 */
  REQUESTED: 'requested',
  /** 🟨 지급 완료 */
  PAID: 'paid',
  /** 🟨 반려 — 금액이 잔액으로 복귀 */
  REJECTED: 'rejected',
} as const

// ─────────────────────────────────────────────────────────────
// 월별 정산 상태
// 🟨 전부 임시
// ─────────────────────────────────────────────────────────────
export const SETTLEMENT_STATUS = {
  /** 🟨 산정됨 — 아직 잔액에 반영 안 됨 */
  CALCULATED: 'calculated',
  /** 🟨 승인됨 — 이때 매니저 출금 가능 잔액에 적립 */
  APPROVED: 'approved',
} as const

// ─────────────────────────────────────────────────────────────
// 대상자 유형
// 🟨 임시 (기획서엔 "어르신/아동" 한글만)
// ─────────────────────────────────────────────────────────────
export const RECIPIENT_TYPE = {
  ELDER: 'elder',
  CHILD: 'child',
} as const

// ─────────────────────────────────────────────────────────────
// 요청 유형 (요청자가 선택)
// 🟦 기획서 명시 — 단 영문값은 🟨 임시
// 🔴 아래 ACTIVITY_TYPE 과 매핑 규칙이 없음. 부록 C-3 참고
// ─────────────────────────────────────────────────────────────
export const REQUEST_TYPE = {
  RIDING: 'riding',       // 병원·이동 라이딩
  ACCOMPANY: 'accompany', // 동행
  HOUSEWORK: 'housework', // 집안일 도움
  MEAL: 'meal',           // 식사 지원
  ETC: 'etc',             // 기타
} as const

// ─────────────────────────────────────────────────────────────
// 활동 유형 (일지에 기록)
// 🔴 확인 필요: 기획서 C-3 작성폼은 "일반/공동체/긴급" 3종인데
//    다른 자료엔 "일반돌봄/픽업/공동체돌봄/긴급돌봄/기타" 5종
//    → 일단 5종으로 두고 확답 오면 정리
// ─────────────────────────────────────────────────────────────
export const ACTIVITY_TYPE = {
  GENERAL: 'general',     // 일반돌봄
  PICKUP: 'pickup',       // 픽업          ← 3종설이면 제거
  COMMUNITY: 'community', // 공동체돌봄
  URGENT: 'urgent',       // 긴급돌봄
  ETC: 'etc',             // 기타          ← 3종설이면 제거
} as const

// ─────────────────────────────────────────────────────────────
// 사용자 역할
// ─────────────────────────────────────────────────────────────
export const USER_ROLE = {
  ADMIN: 'admin',
  HELPER: 'helper',
  RECIPIENT: 'recipient',
} as const

// ═════════════════════════════════════════════════════════════
// 타입 (위 상수에서 자동 생성 — 값 바꾸면 타입도 따라 바뀜)
// ═════════════════════════════════════════════════════════════
type ValueOf<T> = T[keyof T]

export type ManagerStatus = ValueOf<typeof MANAGER_STATUS>
export type RequestStatus = ValueOf<typeof REQUEST_STATUS>
export type LogStatus = ValueOf<typeof LOG_STATUS>
export type PayoutStatus = ValueOf<typeof PAYOUT_STATUS>
export type SettlementStatus = ValueOf<typeof SETTLEMENT_STATUS>
export type RecipientType = ValueOf<typeof RECIPIENT_TYPE>
export type RequestType = ValueOf<typeof REQUEST_TYPE>
export type ActivityType = ValueOf<typeof ACTIVITY_TYPE>
export type UserRole = ValueOf<typeof USER_ROLE>

// ═════════════════════════════════════════════════════════════
// 화면 표시용 라벨 + 색
//
// 한글 라벨은 기획서 원문 표기를 따릅니다. 임의로 바꾸지 마세요.
// tone 은 기획서 제작기획 2-0 상태 색 규약:
//   wait=amber(대기) / progress=blue(진행) / done=emerald(완료) / stop=rose(반려·취소)
// ═════════════════════════════════════════════════════════════
export type Tone = 'wait' | 'progress' | 'done' | 'stop'

export interface StatusMeta {
  label: string
  tone: Tone
}

/** 🟦 라벨은 기획서 B-5 필터 명칭 그대로 */
export const MANAGER_STATUS_META: Record<ManagerStatus, StatusMeta> = {
  [MANAGER_STATUS.APPLIED]: { label: '신청 완료', tone: 'wait' },
  [MANAGER_STATUS.EDUCATED]: { label: '승인 대기', tone: 'progress' },
  [MANAGER_STATUS.ACTIVE]: { label: '활동 가능', tone: 'done' },
  [MANAGER_STATUS.INACTIVE]: { label: '비활성', tone: 'stop' },
}

/** 🟦 라벨은 기획서 B-2 상태 필터 그대로 */
export const REQUEST_STATUS_META: Record<RequestStatus, StatusMeta> = {
  [REQUEST_STATUS.REQUESTED]: { label: '접수', tone: 'wait' },
  [REQUEST_STATUS.PROPOSED]: { label: '시간 제안', tone: 'wait' },
  [REQUEST_STATUS.CONFIRMED]: { label: '확정', tone: 'progress' },
  [REQUEST_STATUS.COMPLETED]: { label: '완료', tone: 'done' },
  [REQUEST_STATUS.CANCELLED]: { label: '취소', tone: 'stop' },
}

export const LOG_STATUS_META: Record<LogStatus, StatusMeta> = {
  [LOG_STATUS.PENDING]: { label: '검토 대기', tone: 'wait' },
  [LOG_STATUS.APPROVED]: { label: '승인', tone: 'done' },
  [LOG_STATUS.REJECTED]: { label: '반려', tone: 'stop' },
}

export const PAYOUT_STATUS_META: Record<PayoutStatus, StatusMeta> = {
  [PAYOUT_STATUS.REQUESTED]: { label: '신청 중', tone: 'progress' },
  [PAYOUT_STATUS.PAID]: { label: '지급 완료', tone: 'done' },
  [PAYOUT_STATUS.REJECTED]: { label: '반려', tone: 'stop' },
}

export const SETTLEMENT_STATUS_META: Record<SettlementStatus, StatusMeta> = {
  [SETTLEMENT_STATUS.CALCULATED]: { label: '산정', tone: 'wait' },
  [SETTLEMENT_STATUS.APPROVED]: { label: '승인', tone: 'done' },
}

export const RECIPIENT_TYPE_META: Record<RecipientType, StatusMeta> = {
  [RECIPIENT_TYPE.ELDER]: { label: '어르신', tone: 'progress' },
  [RECIPIENT_TYPE.CHILD]: { label: '아동', tone: 'wait' },
}

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  [REQUEST_TYPE.RIDING]: '병원·이동 라이딩',
  [REQUEST_TYPE.ACCOMPANY]: '동행',
  [REQUEST_TYPE.HOUSEWORK]: '집안일 도움',
  [REQUEST_TYPE.MEAL]: '식사 지원',
  [REQUEST_TYPE.ETC]: '기타',
}

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  [ACTIVITY_TYPE.GENERAL]: '일반돌봄',
  [ACTIVITY_TYPE.PICKUP]: '픽업',
  [ACTIVITY_TYPE.COMMUNITY]: '공동체돌봄',
  [ACTIVITY_TYPE.URGENT]: '긴급돌봄',
  [ACTIVITY_TYPE.ETC]: '기타',
}

// ═════════════════════════════════════════════════════════════
// 청도군 9개 읍·면
// 🟦 기획서 A-2 명시 — "활동 지역은 청도군 읍·면 화이트리스트만 허용"
// ═════════════════════════════════════════════════════════════
export const CHEONGDO_REGIONS = [
  '청도읍',
  '화양읍',
  '각남면',
  '풍각면',
  '각북면',
  '이서면',
  '운문면',
  '금천면',
  '매전면',
] as const

export type Region = (typeof CHEONGDO_REGIONS)[number]

/** 🟦 매니저 활동 가능 지역 최대 개수 (기획서 A-2) */
export const MAX_ACTIVITY_REGIONS = 10
