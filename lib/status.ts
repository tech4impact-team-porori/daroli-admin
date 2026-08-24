/**
 * 상태값 정의 — 다로리 관리자 대시보드
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  이 파일이 이 프로젝트에서 가장 중요한 파일입니다.            │
 * │  백엔드 값이 확정되면 "여기만" 고치면 됩니다.                 │
 * │  화면 코드에는 절대 문자열을 직접 쓰지 마세요.                │
 * │    ❌  if (log.status === 'PENDING')                         │
 * │    ✅  if (log.status === LOG_STATUS.PENDING)                │
 * └─────────────────────────────────────────────────────────────┘
 *
 * 표기
 *   🟩 계약 확정 — 「다로리 요청자/돌봄매니저 MVP API 계약서 v1.0.0-draft」 5장에 명시.
 *                 백엔드가 실제로 내려주는 값. 절대 바꾸지 말 것
 *   🟨 임시 — 관리자 API 계약이 아직 없어 확정 전. 값이 다르면 이 파일만 교체
 *
 * ⚠️ 계약서 규약: 모든 열거형은 SCREAMING_SNAKE_CASE 대문자다.
 *    관리자 전용 값(일지·출금·정산·활동유형)은 아직 계약이 없지만
 *    같은 규약을 따라 대문자로 통일해 둔다. 나중에 갈리면 혼란만 커진다.
 *
 * 백엔드 확답이 오면:
 *   1) 값이 같다  → 🟨 를 🟩 으로 바꾸고 끝
 *   2) 값이 다르다 → 아래 문자열만 교체. 화면 코드는 손대지 않음
 *   3) 도저히 못 맞추겠다 → lib/data/real.ts 에서 변환 (마지막 수단)
 */

// ─────────────────────────────────────────────────────────────
// 매니저 자격 상태
// 🟩 계약서 5.1 전부 확정
// ─────────────────────────────────────────────────────────────
export const MANAGER_STATUS = {
  /** 🟩 지원서 접수 — 관리자 심사 대기 */
  APPLIED: 'APPLIED',
  /** 🟩 필수 교육 이수 — 활동 승인 대기 */
  EDUCATED: 'EDUCATED',
  /** 🟩 업무 수행 승인 — 이 상태부터만 요청 배정·일지 작성 가능 */
  ACTIVE: 'ACTIVE',
  /** 🟩 현재 업무 수행 불가 */
  INACTIVE: 'INACTIVE',
} as const

// ─────────────────────────────────────────────────────────────
// 돌봄 요청 상태
// 🟩 계약서 5.4 전부 확정
// ─────────────────────────────────────────────────────────────
export const REQUEST_STATUS = {
  /** 🟩 접수됨 — 배정 매니저에게 노출 */
  REQUESTED: 'REQUESTED',
  /** 🟩 시간 제안 — 요청자 확정 대기 */
  PROPOSED: 'PROPOSED',
  /** 🟩 확정 */
  CONFIRMED: 'CONFIRMED',
  /** 🟩 완료 */
  COMPLETED: 'COMPLETED',
  /** 🟩 취소 */
  CANCELLED: 'CANCELLED',
} as const

// ─────────────────────────────────────────────────────────────
// 활동일지 상태
// 🟨 관리자 계약 대기. 계약서 14장에서 "활동일지·검토"는 범위 제외
// ─────────────────────────────────────────────────────────────
export const LOG_STATUS = {
  /** 🟨 검토 대기 */
  PENDING: 'PENDING',
  /** 🟨 승인 — 이 상태만 월별 정산 산정에 포함 */
  APPROVED: 'APPROVED',
  /** 🟨 반려 — 사유 필수 */
  REJECTED: 'REJECTED',
} as const

// ─────────────────────────────────────────────────────────────
// 출금 신청 상태
// 🟨 관리자 계약 대기. 계약서 14장에서 "출금·월별 정산"은 범위 제외
// ─────────────────────────────────────────────────────────────
export const PAYOUT_STATUS = {
  /** 🟨 신청 중 — 잔액에서 이미 차감된 상태로 계산 */
  REQUESTED: 'REQUESTED',
  /** 🟨 지급 완료 */
  PAID: 'PAID',
  /** 🟨 반려 — 금액이 잔액으로 복귀 */
  REJECTED: 'REJECTED',
} as const

// ─────────────────────────────────────────────────────────────
// 월별 정산 상태
// 🟨 관리자 계약 대기
// ─────────────────────────────────────────────────────────────
export const SETTLEMENT_STATUS = {
  /** 🟨 산정됨 — 아직 잔액에 반영 안 됨 */
  CALCULATED: 'CALCULATED',
  /** 🟨 승인됨 — 이때 매니저 출금 가능 잔액에 적립 */
  APPROVED: 'APPROVED',
} as const

// ─────────────────────────────────────────────────────────────
// 대상자 유형
// 🟩 계약서 5.2 확정. 어르신은 ELDER 가 아니라 ELDERLY 다
// ─────────────────────────────────────────────────────────────
export const RECIPIENT_TYPE = {
  ELDERLY: 'ELDERLY',
  CHILD: 'CHILD',
} as const

// ─────────────────────────────────────────────────────────────
// 요청 유형 (요청자가 선택)
// 🟩 계약서 5.3 전부 확정 — 한국어 라벨까지 계약서에 명시돼 있음
// 🔴 아래 ACTIVITY_TYPE 과 매핑 규칙은 여전히 없음
// ─────────────────────────────────────────────────────────────
export const REQUEST_TYPE = {
  HOSPITAL_RIDE: 'HOSPITAL_RIDE',   // 병원·이동 라이딩
  COMPANIONSHIP: 'COMPANIONSHIP',   // 동행
  HOME_HELP: 'HOME_HELP',           // 집안일 도움
  MEAL_SUPPORT: 'MEAL_SUPPORT',     // 식사 지원
  OTHER: 'OTHER',                   // 기타
} as const

// ─────────────────────────────────────────────────────────────
// 활동 유형 (일지에 기록)
// 🟨 관리자 계약 대기. 3종인지 5종인지도 미확정
//    계약서가 "기타"를 OTHER 로 쓰므로 ETC 대신 OTHER 로 통일
// ─────────────────────────────────────────────────────────────
export const ACTIVITY_TYPE = {
  GENERAL: 'GENERAL',     // 일반돌봄
  PICKUP: 'PICKUP',       // 픽업          ← 3종설이면 제거
  COMMUNITY: 'COMMUNITY', // 공동체돌봄
  URGENT: 'URGENT',       // 긴급돌봄
  OTHER: 'OTHER',         // 기타          ← 3종설이면 제거
} as const

// ─────────────────────────────────────────────────────────────
// 사용자 역할
// 🟩 계약서 3.1 확정 — 공개 역할 값은 정확히 이 셋뿐이다
//
// ⚠️ 용어 주의: 계약서 3.2 는 둘을 명확히 분리한다
//    REQUESTER(요청자) = 돌봄 요청을 제출하는 로그인 계정
//    recipient(대상자) = 실제 돌봄을 받는 사람 (Recipient 타입)
//    예전엔 요청자를 recipient 라 불렀는데 계약서 기준으로 REQUESTER 가 맞다
// ─────────────────────────────────────────────────────────────
export const USER_ROLE = {
  ADMIN: 'ADMIN',
  HELPER: 'HELPER',
  REQUESTER: 'REQUESTER',
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
  [RECIPIENT_TYPE.ELDERLY]: { label: '어르신', tone: 'progress' },
  [RECIPIENT_TYPE.CHILD]: { label: '아동', tone: 'wait' },
}

/** 🟩 한국어 라벨도 계약서 5.3 에 명시된 그대로 */
export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  [REQUEST_TYPE.HOSPITAL_RIDE]: '병원·이동 라이딩',
  [REQUEST_TYPE.COMPANIONSHIP]: '동행',
  [REQUEST_TYPE.HOME_HELP]: '집안일 도움',
  [REQUEST_TYPE.MEAL_SUPPORT]: '식사 지원',
  [REQUEST_TYPE.OTHER]: '기타',
}

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  [ACTIVITY_TYPE.GENERAL]: '일반돌봄',
  [ACTIVITY_TYPE.PICKUP]: '픽업',
  [ACTIVITY_TYPE.COMMUNITY]: '공동체돌봄',
  [ACTIVITY_TYPE.URGENT]: '긴급돌봄',
  [ACTIVITY_TYPE.OTHER]: '기타',
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
