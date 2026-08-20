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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { STALE_HOURS } from "@/lib/calc"
import { db } from "@/lib/data"
import { REQUEST_STATUS, REQUEST_STATUS_META, REQUEST_TYPE_LABEL } from "@/lib/status"
import type { CareRequestRow, RequestStatus } from "@/lib/types"

const ALL = "all"

export default function RequestsPage() {
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>(ALL)

  const [requests, setRequests] = useState<CareRequestRow[] | null>(null)
  const [fetchedAt, setFetchedAt] = useState(0)
  const [error, setError] = useState<string | null>(null)

  function fetchRequests() {
    setError(null)
    setRequests(null)
    db.listRequests({
      keyword: keyword.trim() || undefined,
      status: statusFilter === ALL ? undefined : (statusFilter as RequestStatus),
    })
      .then((rows) => {
        setRequests(rows)
        setFetchedAt(Date.now())
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "요청 목록을 불러오지 못했습니다"),
      )
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 상태 필터 변경 시 목록 재조회
    fetchRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const statusItems = {
    [ALL]: "전체 상태",
    [REQUEST_STATUS.REQUESTED]: REQUEST_STATUS_META[REQUEST_STATUS.REQUESTED].label,
    [REQUEST_STATUS.PROPOSED]: REQUEST_STATUS_META[REQUEST_STATUS.PROPOSED].label,
    [REQUEST_STATUS.CONFIRMED]: REQUEST_STATUS_META[REQUEST_STATUS.CONFIRMED].label,
    [REQUEST_STATUS.COMPLETED]: REQUEST_STATUS_META[REQUEST_STATUS.COMPLETED].label,
    [REQUEST_STATUS.CANCELLED]: REQUEST_STATUS_META[REQUEST_STATUS.CANCELLED].label,
  }

  const staleIds = useMemo(() => {
    if (!requests || !fetchedAt) return new Set<string>()
    return new Set(
      requests
        .filter(
          (r) =>
            r.status === REQUEST_STATUS.REQUESTED &&
            fetchedAt - new Date(r.createdAt).getTime() >= STALE_HOURS * 60 * 60 * 1000,
        )
        .map((r) => r.id),
    )
  }, [requests, fetchedAt])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">요청 현황</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchRequests()}
          placeholder="대상자·매니저·내용 검색"
          className="max-w-64"
        />
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
        <Button variant="outline" size="sm" onClick={fetchRequests}>
          검색
        </Button>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-rose-700">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchRequests}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && requests === null && (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <span className="mr-2 size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          불러오는 중...
        </div>
      )}

      {!error && requests !== null && requests.length === 0 && (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-24 text-sm text-muted-foreground">
          표시할 요청이 없습니다
        </div>
      )}

      {!error && requests !== null && requests.length > 0 && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>상태</TableHead>
                  <TableHead>대상자 · 매니저</TableHead>
                  <TableHead>돌봄 유형</TableHead>
                  <TableHead>희망 일시</TableHead>
                  <TableHead>지역</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id} className={staleIds.has(r.id) ? "bg-amber-50" : undefined}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge {...REQUEST_STATUS_META[r.status]} />
                        {staleIds.has(r.id) && (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-100 text-xs text-amber-800"
                            title={`접수 후 ${STALE_HOURS}시간 경과, 시간 제안 없음`}
                          >
                            배정 지연
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{r.recipientName}</div>
                      <div className="text-xs text-muted-foreground">{r.managerName ?? "미배정"}</div>
                    </TableCell>
                    <TableCell>{REQUEST_TYPE_LABEL[r.requestType]}</TableCell>
                    <TableCell className="tabular-nums">
                      {r.desiredAt.slice(0, 10)} {r.desiredAt.slice(11, 16)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {r.region}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
