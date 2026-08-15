"use client"

import { useEffect, useMemo, useState } from "react"

import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatWon, sumWon } from "@/lib/calc"
import { db } from "@/lib/data"
import { CHEONGDO_REGIONS, MANAGER_STATUS, MANAGER_STATUS_META } from "@/lib/status"
import type { ManagerStatus, ManagerWithStats, Region } from "@/lib/types"

const ALL = "all"

export default function ManagersPage() {
  const [keyword, setKeyword] = useState("")
  const [regionFilter, setRegionFilter] = useState<string>(ALL)
  const [statusFilter, setStatusFilter] = useState<string>(ALL)

  const [managers, setManagers] = useState<ManagerWithStats[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  function fetchManagers() {
    setError(null)
    setManagers(null)
    db.listManagers({
      keyword: keyword.trim() || undefined,
      region: regionFilter === ALL ? undefined : (regionFilter as Region),
      status: statusFilter === ALL ? undefined : (statusFilter as ManagerStatus),
    })
      .then(setManagers)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "매니저 목록을 불러오지 못했습니다"),
      )
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 필터 변경 시 목록 재조회
    fetchManagers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionFilter, statusFilter])

  async function handleStatusChange(manager: ManagerWithStats, next: ManagerStatus) {
    setActionId(manager.id)
    try {
      await db.updateManagerStatus(manager.id, next)
      fetchManagers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 변경에 실패했습니다")
    } finally {
      setActionId(null)
    }
  }

  const regionItems = useMemo(
    () => ({ [ALL]: "전체 지역", ...Object.fromEntries(CHEONGDO_REGIONS.map((r) => [r, r])) }),
    [],
  )
  const statusItems = {
    [ALL]: "전체 상태",
    [MANAGER_STATUS.APPLIED]: MANAGER_STATUS_META[MANAGER_STATUS.APPLIED].label,
    [MANAGER_STATUS.EDUCATED]: MANAGER_STATUS_META[MANAGER_STATUS.EDUCATED].label,
    [MANAGER_STATUS.ACTIVE]: MANAGER_STATUS_META[MANAGER_STATUS.ACTIVE].label,
    [MANAGER_STATUS.INACTIVE]: MANAGER_STATUS_META[MANAGER_STATUS.INACTIVE].label,
  }

  const totals = useMemo(() => {
    if (!managers) return null
    return {
      monthlyLogCount: managers.reduce((sum, m) => sum + m.monthlyLogCount, 0),
      totalLogCount: managers.reduce((sum, m) => sum + m.totalLogCount, 0),
      approvedTotal: sumWon(managers, (m) => m.approvedTotal),
      paidTotal: sumWon(managers, (m) => m.paidTotal),
      balance: sumWon(managers, (m) => m.balance),
    }
  }, [managers])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">매니저 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          활동 가능(active) 상태부터 요청 배정과 활동일지 작성이 가능합니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchManagers()}
          placeholder="이름·이메일 검색"
          className="max-w-56"
        />
        <Select items={regionItems} value={regionFilter} onValueChange={(v) => setRegionFilter(v as string)}>
          <SelectTrigger>
            <SelectValue placeholder="지역" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체 지역</SelectItem>
            {CHEONGDO_REGIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={statusItems} value={statusFilter} onValueChange={(v) => setStatusFilter(v as string)}>
          <SelectTrigger>
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(statusItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchManagers}>
          검색
        </Button>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-rose-700">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchManagers}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && managers === null && (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <span className="mr-2 size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          불러오는 중...
        </div>
      )}

      {!error && managers !== null && managers.length === 0 && (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-24 text-sm text-muted-foreground">
          표시할 매니저가 없습니다
        </div>
      )}

      {!error && managers !== null && managers.length > 0 && totals && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름·연락처</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>거주 지역</TableHead>
                  <TableHead>활동 지역</TableHead>
                  <TableHead>자차</TableHead>
                  <TableHead className="text-right">담당 대상자</TableHead>
                  <TableHead className="text-right">이번 달 활동</TableHead>
                  <TableHead className="text-right">누적 활동</TableHead>
                  <TableHead className="text-right">승인 누적액</TableHead>
                  <TableHead className="text-right">지급 완료액</TableHead>
                  <TableHead className="text-right">잔액</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.map((m) => (
                  <TableRow key={m.id} className={m.deletedAt ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="font-medium">
                        {m.name}
                        {m.deletedAt && <span className="ml-1 text-xs text-muted-foreground">(삭제됨)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.phone}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge {...MANAGER_STATUS_META[m.status]} />
                    </TableCell>
                    <TableCell>{m.homeRegion}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.activityRegions.map((r) => (
                          <Badge key={r} variant="outline" className="text-xs">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{m.hasCar ? "있음" : "없음"}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.recipientCount}명</TableCell>
                    <TableCell className="text-right tabular-nums">{m.monthlyLogCount}건</TableCell>
                    <TableCell className="text-right tabular-nums">{m.totalLogCount}건</TableCell>
                    <TableCell className="text-right tabular-nums">{formatWon(m.approvedTotal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatWon(m.paidTotal)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatWon(m.balance)}</TableCell>
                    <TableCell className="text-right">
                      <ManagerAction manager={m} pending={actionId === m.id} onChange={handleStatusChange} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6}>합계</TableCell>
                  <TableCell className="text-right tabular-nums">{totals.monthlyLogCount}건</TableCell>
                  <TableCell className="text-right tabular-nums">{totals.totalLogCount}건</TableCell>
                  <TableCell className="text-right tabular-nums">{formatWon(totals.approvedTotal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatWon(totals.paidTotal)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatWon(totals.balance)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ManagerAction({
  manager,
  pending,
  onChange,
}: {
  manager: ManagerWithStats
  pending: boolean
  onChange: (manager: ManagerWithStats, next: ManagerStatus) => void
}) {
  switch (manager.status) {
    case MANAGER_STATUS.APPLIED:
      return (
        <Button size="sm" disabled={pending} onClick={() => onChange(manager, MANAGER_STATUS.EDUCATED)}>
          교육 이수 확인
        </Button>
      )
    case MANAGER_STATUS.EDUCATED:
      return (
        <Button size="sm" disabled={pending} onClick={() => onChange(manager, MANAGER_STATUS.ACTIVE)}>
          활동 승인
        </Button>
      )
    case MANAGER_STATUS.ACTIVE:
      return (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => onChange(manager, MANAGER_STATUS.INACTIVE)}
        >
          비활성화
        </Button>
      )
    case MANAGER_STATUS.INACTIVE:
      return (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => onChange(manager, MANAGER_STATUS.ACTIVE)}
        >
          활동 재개
        </Button>
      )
    default:
      return null
  }
}
