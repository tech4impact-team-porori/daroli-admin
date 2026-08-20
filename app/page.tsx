"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatRate, formatWon, STALE_HOURS } from "@/lib/calc"
import { db } from "@/lib/data"
import type { ActionQueue, DashboardData, YearMonth } from "@/lib/types"
import { lastNMonths } from "@/lib/utils"

const MONTH_COUNT = 6

// dataviz 스킬 검증된 카테고리 팔레트 slot1(blue)/slot2(orange) — 제출/승인 2계열
const COLOR_SUBMITTED = "#2a78d6"
const COLOR_APPROVED = "#eb6834"

export default function DashboardPage() {
  const months = useMemo(() => lastNMonths(MONTH_COUNT), [])
  const [selectedMonth, setSelectedMonth] = useState<YearMonth>(months[months.length - 1])

  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  function fetchDashboard(month: YearMonth) {
    setError(null)
    setData(null)
    db.getDashboard(month)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "대시보드를 불러오지 못했습니다"),
      )
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 월 변경 시 대시보드 재조회
    fetchDashboard(selectedMonth)
  }, [selectedMonth])

  const monthItems = useMemo(
    () => Object.fromEntries([...months].reverse().map((m) => [m, m])),
    [months],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <Select items={monthItems} value={selectedMonth} onValueChange={(v) => setSelectedMonth(v as YearMonth)}>
          <SelectTrigger>
            <SelectValue placeholder="월" />
          </SelectTrigger>
          <SelectContent>
            {[...months].reverse().map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-rose-700">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchDashboard(selectedMonth)}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && data === null && (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <span className="mr-2 size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          불러오는 중...
        </div>
      )}

      {!error && data !== null && (
        <>
          <ActionQueueSection actions={data.actions} />
          <MonthlySnapshot data={data} />
          <TrendSection data={data} />
        </>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// ① 지금 처리할 일 — 액션 큐 (docs/대시보드_재설계.md 4장)
// ═════════════════════════════════════════════════════════════

type ActionTone = "danger" | "warning" | "neutral"

interface ActionItem {
  key: string
  label: string
  detail: string
  href: string
  tone: ActionTone
}

const TONE_CLASS: Record<ActionTone, string> = {
  danger: "border-l-rose-500 bg-rose-50/60",
  warning: "border-l-amber-500 bg-amber-50/60",
  neutral: "border-l-border bg-transparent",
}

const TONE_LABEL_CLASS: Record<ActionTone, string> = {
  danger: "text-rose-700",
  warning: "text-amber-700",
  neutral: "text-foreground",
}

// detail 포맷 규칙 (docs/작업지시_문구정리.md B-1): "{숫자+단위} · {판단 근거}".
// 완결형 문장·종결어미 금지, 구분자는 " · " 하나로 고정. 아래 함수들은 이미 계산된
// 값을 문자열로 조립만 한다 — 집계·필터·날짜 계산은 lib/calc.ts 에만 있다.

function daysSuffix(days: number): string {
  return days > 0 ? ` · 최장 ${days}일 경과` : ""
}

function formatManagerBreakdown(applied: number, educated: number): string {
  const parts: string[] = []
  if (applied > 0) parts.push(`신청 ${applied}`)
  if (educated > 0) parts.push(`교육이수 ${educated}`)
  return parts.length > 0 ? ` · ${parts.join(" · ")}` : ""
}

function formatUnassignedByRegion(byRegion: { region: string; count: number }[]): string {
  if (byRegion.length === 0) return ""
  const shown = byRegion.slice(0, 2).map((r) => `${r.region} ${r.count}`)
  if (byRegion.length > 2) shown.push(`외 ${byRegion.length - 2}곳`)
  return ` · ${shown.join(" · ")}`
}

function formatShortageRegionList(regions: string[]): string {
  if (regions.length < 5) return regions.join(", ")
  return `${regions.slice(0, 3).join(", ")} 외 ${regions.length - 3}곳`
}

function buildActionItems(actions: ActionQueue): ActionItem[] {
  const items: ActionItem[] = []

  if (actions.approvedUnpaid > 0) {
    items.push({
      key: "approved-unpaid",
      label: "정산 필요",
      detail: `${formatWon(actions.approvedUnpaid)} · 매니저 ${actions.unpaidManagerCount}명분`,
      href: "/payments",
      tone: "danger",
    })
  }
  if (actions.requestedPayoutCount > 0) {
    items.push({
      key: "requested-payout",
      label: "출금 신청 대기",
      detail: `${actions.requestedPayoutCount}건${daysSuffix(actions.oldestRequestedPayoutDays)}`,
      href: "/payments",
      tone: "danger",
    })
  }
  if (actions.pendingLogCount > 0) {
    items.push({
      key: "pending-log",
      label: "일지 검토 대기",
      detail: `${actions.pendingLogCount}건${daysSuffix(actions.oldestPendingDays)}`,
      href: "/review",
      tone: "warning",
    })
  }
  if (actions.staleRequestCount > 0) {
    items.push({
      key: "stale-request",
      label: "배정 지연 요청",
      detail: `${actions.staleRequestCount}건 · ${STALE_HOURS}시간 초과`,
      href: "/requests",
      tone: "warning",
    })
  }
  if (actions.pendingManagerCount > 0) {
    items.push({
      key: "pending-manager",
      label: "매니저 심사 대기",
      detail: `${actions.pendingManagerCount}명${formatManagerBreakdown(actions.appliedManagerCount, actions.educatedManagerCount)}`,
      href: "/managers",
      tone: "neutral",
    })
  }
  if (actions.unassignedRecipientCount > 0) {
    items.push({
      key: "unassigned-recipient",
      label: "미배정 대상자",
      detail: `${actions.unassignedRecipientCount}명${formatUnassignedByRegion(actions.unassignedByRegion)}`,
      href: "/recipients",
      tone: "neutral",
    })
  }
  if (actions.shortageRegions.length > 0) {
    items.push({
      key: "shortage-region",
      label: "매니저 부족 지역",
      detail: `${actions.shortageRegions.length}곳 · ${formatShortageRegionList(actions.shortageRegions)}`,
      href: "/managers#region-map",
      tone: "neutral",
    })
  }
  if (actions.needsBudgetSetup) {
    items.push({
      key: "budget-setup",
      label: "배정 예산 미설정",
      detail: actions.budgetSetupMonth,
      href: "/settings",
      tone: "neutral",
    })
  }

  return items
}

function ActionQueueSection({ actions }: { actions: ActionQueue }) {
  const items = buildActionItems(actions)

  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">지금 처리할 일</h2>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">지금 처리할 일이 없습니다</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center justify-between gap-4 border-l-4 px-3 py-3 transition-colors hover:bg-muted/50",
                  TONE_CLASS[item.tone],
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className={cn("text-sm font-semibold", TONE_LABEL_CLASS[item.tone])}>{item.label}</span>
                  <span className="text-sm text-muted-foreground">{item.detail}</span>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ═════════════════════════════════════════════════════════════
// ② 이번 달 현황 — 통계 4종 (docs/대시보드_재설계.md 5장). 액션 없음, 클릭 안 됨
// ═════════════════════════════════════════════════════════════

function MonthlySnapshot({ data }: { data: DashboardData }) {
  const approvedThisMonth = data.trend.at(-1)?.approved ?? 0
  const totalManagerCount = data.managerPayments.length

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatTile label="활동 건수" value={`${approvedThisMonth}건`} sub="승인 기준" />
      <StatTile
        label="활동 중인 매니저"
        value={`${data.activeManagerCount}명`}
        sub={`전체 ${totalManagerCount}명 중`}
      />
      <StatTile
        label="관리 대상자"
        value={`${data.recipientCount}명`}
        sub={`어르신 ${data.elderCount}명 · 아동 ${data.childCount}명`}
      />
      <StatTile
        label="예산 사용률"
        value={formatRate(data.budget.usageRate)}
        sub={`남은 예산 ${formatWon(data.budget.remaining)}`}
      />
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// ③ 활동 추이 — 최근 6개월, 축소 (docs/대시보드_재설계.md 6장)
// ═════════════════════════════════════════════════════════════

function TrendSection({ data }: { data: DashboardData }) {
  const last = data.trend.at(-1)
  const gap = last ? last.submitted - last.approved : 0

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">최근 6개월 활동 추이</h2>
        <div className="h-[100px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#e1e0d9" vertical={false} />
              <XAxis
                dataKey="yearMonth"
                tick={{ fill: "#898781", fontSize: 11 }}
                axisLine={{ stroke: "#c3c2b7" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#898781", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="submitted"
                name="제출 건수"
                stroke={COLOR_SUBMITTED}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="approved"
                name="승인 건수"
                stroke={COLOR_APPROVED}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {last && gap > 0 && (
          <p className="text-xs text-muted-foreground">
            미승인 {gap}건 · 제출 {last.submitted} / 승인 {last.approved}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ═════════════════════════════════════════════════════════════
// 공용 조각
// ═════════════════════════════════════════════════════════════

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-3xl font-bold tabular-nums">{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  )
}
