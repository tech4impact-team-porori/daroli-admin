"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
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

import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatRate, formatWon } from "@/lib/calc"
import { db } from "@/lib/data"
import type { DashboardData, YearMonth } from "@/lib/types"
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
          {data.pendingLogCount > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="flex items-center justify-between gap-4 py-3">
                <p className="text-sm text-amber-800">
                  검토 대기 활동일지가 <span className="font-semibold">{data.pendingLogCount}건</span> 있습니다
                </p>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/review" />}>
                  지금 검토하기
                </Button>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="budget">
            <TabsList>
              <TabsTrigger value="budget">예산</TabsTrigger>
              <TabsTrigger value="managers">매니저</TabsTrigger>
              <TabsTrigger value="recipients">돌봄 수요자</TabsTrigger>
            </TabsList>

            <TabsContent value="budget" className="mt-4">
              <BudgetTab data={data} />
            </TabsContent>
            <TabsContent value="managers" className="mt-4">
              <ManagersTab data={data} />
            </TabsContent>
            <TabsContent value="recipients" className="mt-4">
              <RecipientsTab data={data} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// 탭 1 — 예산 (기획서 2-6)
// ═════════════════════════════════════════════════════════════

function BudgetTab({ data }: { data: DashboardData }) {
  const { budget, monthlyBudget } = data

  return (
    <div className="flex flex-col gap-4">
      <StatTile label="이번 달 예상 활동비" value={formatWon(monthlyBudget.estimated)} />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground">예산 현황 (전체)</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MiniStat label="전체 예산" value={formatWon(budget.totalBudget)} />
            <MiniStat label="지급 완료액" value={formatWon(budget.paidTotal)} />
            <MiniStat label="정산 필요 (승인 미지급)" value={formatWon(budget.approvedUnpaid)} warn />
            <MiniStat label="승인 대기 예상액" value={formatWon(budget.pendingEstimate)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">사용률 (승인 정산 총액 ÷ 전체 예산)</span>
              <span className="font-medium tabular-nums">{formatRate(budget.usageRate)}</span>
            </div>
            <ProgressBar ratio={budget.usageRate} color="bg-primary" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            <MiniStat label="활동 평균 지급액" value={formatWon(budget.averagePerActivity)} />
            <MiniStat label="남은 예산 기준 가능 활동 횟수" value={`${budget.possibleActivities.toLocaleString("ko-KR")}회`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground">이번 달 예산 현황 — {monthlyBudget.yearMonth}</h2>
          {monthlyBudget.assigned <= 0 ? (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">이번 달 배정 예산이 설정되지 않았습니다.</p>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/settings" />}>
                설정에서 지정하기
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <MiniStat label="배정 예산" value={formatWon(monthlyBudget.assigned)} />
                <MiniStat label="승인 정산액" value={formatWon(monthlyBudget.approved)} />
                <MiniStat label="산정 중 금액" value={formatWon(monthlyBudget.calculating)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">잔여 예산</span>
                  <span className="font-medium tabular-nums">{formatWon(monthlyBudget.remaining)}</span>
                </div>
                <ProgressBar
                  ratio={monthlyBudget.assigned > 0 ? monthlyBudget.approved / monthlyBudget.assigned : 0}
                  color="bg-emerald-500"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// 탭 2 — 매니저 (기획서 2-7)
// ═════════════════════════════════════════════════════════════

function ManagersTab({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-4">
      <StatTile label="활동 중인 매니저 수" value={`${data.activeManagerCount}명`} />

      <Card>
        <CardContent>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">매니저별 지급 현황 (승인액 내림차순)</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>매니저명</TableHead>
                <TableHead className="text-right">이달 활동 수</TableHead>
                <TableHead className="text-right">승인 정산액</TableHead>
                <TableHead className="text-right">지급 완료</TableHead>
                <TableHead className="text-right">출금 가능 잔액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.managerPayments.map((m) => (
                <TableRow key={m.managerId}>
                  <TableCell>
                    {m.managerName}
                    {m.isRetired && <span className="ml-1 text-xs text-muted-foreground">(비활성/삭제)</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.monthlyLogCount}건</TableCell>
                  <TableCell className="text-right tabular-nums">{formatWon(m.approvedTotal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatWon(m.paidTotal)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatWon(m.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MapPlaceholder />

      <Card>
        <CardContent>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">지역별 매니저 현황</h2>
          <RegionTable data={data} columns="managers" />
        </CardContent>
      </Card>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// 탭 3 — 돌봄 수요자 (기획서 2-8)
// ═════════════════════════════════════════════════════════════

function RecipientsTab({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label="관리 대상자 수"
          value={`${data.recipientCount}명`}
          sub={`어르신 ${data.elderCount}명 · 아동 ${data.childCount}명`}
        />
        <StatTile label="이번 달 전체 일지 수" value={`${data.monthlyLogTotal}건`} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground">최근 6개월 활동 추이</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#e1e0d9" vertical={false} />
                <XAxis
                  dataKey="yearMonth"
                  tick={{ fill: "#898781", fontSize: 12 }}
                  axisLine={{ stroke: "#c3c2b7" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#898781", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip contentStyle={{ fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line
                  type="monotone"
                  dataKey="submitted"
                  name="제출 건수"
                  stroke={COLOR_SUBMITTED}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="approved"
                  name="승인 건수"
                  stroke={COLOR_APPROVED}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">
            제출과 승인의 간격이 벌어질수록 검토가 밀리고 있다는 신호입니다.
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>월</TableHead>
                <TableHead className="text-right">제출</TableHead>
                <TableHead className="text-right">승인</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.trend.map((t) => (
                <TableRow key={t.yearMonth}>
                  <TableCell>{t.yearMonth}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.submitted}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.approved}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MapPlaceholder />

      <Card>
        <CardContent>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">지역별 돌봄 수요</h2>
          <RegionTable data={data} columns="recipients" />
        </CardContent>
      </Card>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// 공용 조각
// ═════════════════════════════════════════════════════════════

function RegionTable({ data, columns }: { data: DashboardData; columns: "managers" | "recipients" }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>지역</TableHead>
          <TableHead className="text-right">대상자 수</TableHead>
          {columns === "managers" ? (
            <>
              <TableHead className="text-right">활동가능 매니저</TableHead>
              <TableHead className="text-right">배정 매니저</TableHead>
            </>
          ) : (
            <TableHead className="text-right">이달 활동 수</TableHead>
          )}
          <TableHead>상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.regions.map((r) => (
          <TableRow key={r.region}>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {r.region}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">{r.recipientCount}명</TableCell>
            {columns === "managers" ? (
              <>
                <TableCell className="text-right tabular-nums">{r.activeManagerCount}명</TableCell>
                <TableCell className="text-right tabular-nums">{r.assignedManagerCount}명</TableCell>
              </>
            ) : (
              <TableCell className="text-right tabular-nums">{r.monthlyLogCount}건</TableCell>
            )}
            <TableCell>
              {r.isShortage ? (
                <StatusBadge label="도움 필요" tone="stop" />
              ) : (
                <StatusBadge label="양호" tone="done" />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MapPlaceholder() {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-12 text-sm text-muted-foreground">
      통합 지역 지도는 청도군 GeoJSON 준비 후 추가됩니다 (Phase 8)
    </div>
  )
}

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

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={warn ? "text-lg font-semibold tabular-nums text-amber-600" : "text-lg font-semibold tabular-nums"}>
        {value}
      </span>
    </div>
  )
}

function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  const pct = Math.min(100, Math.max(0, ratio * 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
