/**
 * 데이터 접근 통로 — 다로리 관리자 대시보드
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  화면 컴포넌트는 DB를 직접 부르지 않습니다.                   │
 * │  전부 이 파일의 `db` 를 통해서만 데이터를 가져옵니다.         │
 * │                                                             │
 * │  지금:  mock.ts (가짜 데이터)                                │
 * │  나중:  real.ts (백엔드 DB 연결)                             │
 * │  전환:  환경변수 하나. 화면 코드는 한 줄도 안 바뀝니다.       │
 * └─────────────────────────────────────────────────────────────┘
 *
 * 백엔드 값이 우리 정의와 다를 때는 real.ts 안에서 변환합니다.
 * status.ts 나 화면 코드를 고치는 게 아닙니다.
 */

import type {
  ActivityLogCard,
  CareRequestRow,
  DashboardData,
  LogFilter,
  Manager,
  ManagerFilter,
  ManagerWithStats,
  ManagerStatus,
  PayoutRow,
  Recipient,
  RecipientFilter,
  RecipientWithManager,
  RegionStat,
  RequestFilter,
  SettlementRow,
  Settings,
  YearMonth,
} from '../types'
import type { PayoutStatus } from '../status'

export interface DataSource {
  // ── 대시보드 (admin-dashboard-*) ──────────────────────────
  /**
   * 3탭 전체 데이터를 한 번에.
   * 🔴 백엔드에 이 형태로 요청할 것 — 나눠 부르면 요청이 여러 번 나갑니다
   */
  getDashboard(yearMonth: YearMonth): Promise<DashboardData>

  /** 지도 + 지역별 표 공용 */
  getRegionStats(yearMonth: YearMonth): Promise<RegionStat[]>

  // ── 활동일지 검토 (admin-review) ──────────────────────────
  listLogs(filter: LogFilter): Promise<ActivityLogCard[]>
  approveLog(id: string): Promise<void>
  /** 🟦 사유 필수 — 빈 문자열이면 호출하지 말 것 */
  rejectLog(id: string, reason: string): Promise<void>

  // ── 활동비 관리 (admin-payments) ──────────────────────────
  /** 🟦 월별 정산 생성(재산정). 미승인 건만 갱신됩니다 */
  generateSettlements(yearMonth: YearMonth): Promise<void>
  listSettlements(yearMonth: YearMonth): Promise<SettlementRow[]>
  /** 🟦 정산 승인 → 이 시점에 매니저 잔액에 적립 */
  approveSettlement(id: string): Promise<void>
  /** 🟦 잔액이 음수가 되면 서버가 거부해야 함 */
  cancelSettlementApproval(id: string): Promise<void>

  listPayouts(status?: PayoutStatus): Promise<PayoutRow[]>
  markPayoutPaid(id: string): Promise<void>
  /** 🟦 사유 필수. 반려 금액은 잔액으로 복귀 */
  rejectPayout(id: string, reason: string): Promise<void>

  // ── 매니저 관리 (admin-managers) ──────────────────────────
  /** 🔴 집계값 포함해서 한 번에. 따로 부르면 N+1 */
  listManagers(filter: ManagerFilter): Promise<ManagerWithStats[]>
  getManager(id: string): Promise<ManagerWithStats | null>
  /** applied → educated → active 전이. 되돌리기도 가능해야 함 */
  updateManagerStatus(id: string, status: ManagerStatus): Promise<void>
  updateManager(id: string, patch: Partial<Manager>): Promise<void>

  // ── 대상자 관리 (admin-recipients) ────────────────────────
  listRecipients(filter: RecipientFilter): Promise<RecipientWithManager[]>
  createRecipient(input: Omit<Recipient, 'id' | 'createdAt'>): Promise<string>
  updateRecipient(id: string, patch: Partial<Recipient>): Promise<void>
  /** 🟦 실제 삭제가 아니라 deletedAt 표시 */
  deleteRecipient(id: string): Promise<void>

  // ── 요청 현황 (admin-requests) ────────────────────────────
  listRequests(filter: RequestFilter): Promise<CareRequestRow[]>

  // ── 시스템 설정 (admin-settings) ──────────────────────────
  getSettings(): Promise<Settings>
  updateSettings(patch: Partial<Settings>): Promise<void>
}

/**
 * 실제 사용처.
 * Phase 2에서 mock.ts 를 만들고 여기 연결합니다.
 *
 *   import { mockDataSource } from './mock'
 *   import { realDataSource } from './real'
 *   export const db: DataSource =
 *     process.env.NEXT_PUBLIC_USE_REAL_DB === 'true' ? realDataSource : mockDataSource
 */
export const db: DataSource = new Proxy({} as DataSource, {
  get(_target, prop) {
    throw new Error(
      `[lib/data] db.${String(prop)}() 를 불렀지만 아직 데이터 소스가 연결되지 않았습니다.\n` +
        `Phase 2에서 lib/data/mock.ts 를 만들고 lib/data/index.ts 의 db 를 교체하세요.`,
    )
  },
})
