"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { RejectDialog } from "@/components/reject-dialog"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { db } from "@/lib/data"
import {
  ACTIVITY_TYPE_LABEL,
  LOG_STATUS,
  LOG_STATUS_META,
  RECIPIENT_TYPE_META,
} from "@/lib/status"
import type { ActivityLogCard, LogStatus, ManagerWithStats } from "@/lib/types"

const ALL = "all"

export default function ReviewPage() {
  // 🟦 기획서 2-1: 정렬 기본값은 오래된 순(대기가 쌓이지 않게), 상태는 검토 대기부터
  const [statusFilter, setStatusFilter] = useState<LogStatus | typeof ALL>(LOG_STATUS.PENDING)
  const [managerFilter, setManagerFilter] = useState<string>(ALL)
  const [monthFilter, setMonthFilter] = useState<string>(ALL)

  const [logs, setLogs] = useState<ActivityLogCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [managers, setManagers] = useState<ManagerWithStats[]>([])

  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ActivityLogCard | null>(null)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  useEffect(() => {
    db.listManagers({}).then(setManagers).catch(() => undefined)
  }, [])

  function fetchLogs() {
    setError(null)
    setLogs(null)
    db.listLogs({
      status: statusFilter === ALL ? undefined : statusFilter,
      managerId: managerFilter === ALL ? undefined : managerFilter,
    })
      .then(setLogs)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "일지를 불러오지 못했습니다"),
      )
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 필터 변경 시 목록을 다시 불러오는 표준 패턴
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, managerFilter])

  const months = useMemo(() => {
    if (!logs) return []
    const set = new Set(logs.map((l) => l.activityDate.slice(0, 7)))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [logs])

  const monthItems = useMemo(
    () => ({ [ALL]: "전체 월", ...Object.fromEntries(months.map((m) => [m, m])) }),
    [months],
  )
  const statusItems = useMemo(
    () => ({
      [ALL]: "전체 상태",
      [LOG_STATUS.PENDING]: LOG_STATUS_META[LOG_STATUS.PENDING].label,
      [LOG_STATUS.APPROVED]: LOG_STATUS_META[LOG_STATUS.APPROVED].label,
      [LOG_STATUS.REJECTED]: LOG_STATUS_META[LOG_STATUS.REJECTED].label,
    }),
    [],
  )
  const managerItems = useMemo(
    () => ({ [ALL]: "전체 매니저", ...Object.fromEntries(managers.map((m) => [m.id, m.name])) }),
    [managers],
  )

  const visibleLogs = useMemo(() => {
    if (!logs) return []
    const filtered =
      monthFilter === ALL ? logs : logs.filter((l) => l.activityDate.startsWith(monthFilter))
    return [...filtered].sort(
      (a, b) => a.activityDate.localeCompare(b.activityDate) || a.startedAt.localeCompare(b.startedAt),
    )
  }, [logs, monthFilter])

  async function handleApprove(log: ActivityLogCard) {
    setPendingActionId(log.id)
    try {
      await db.approveLog(log.id)
      fetchLogs()
    } catch (err) {
      setError(err instanceof Error ? err.message : "승인하지 못했습니다")
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectTarget) return
    setRejectSubmitting(true)
    try {
      await db.rejectLog(rejectTarget.id, reason)
      setRejectTarget(null)
      fetchLogs()
    } catch (err) {
      setError(err instanceof Error ? err.message : "반려하지 못했습니다")
    } finally {
      setRejectSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">일지 검토</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select items={monthItems} value={monthFilter} onValueChange={(v) => setMonthFilter(v as string)}>
          <SelectTrigger>
            <SelectValue placeholder="월" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체 월</SelectItem>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={statusItems}
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as LogStatus | typeof ALL)}
        >
          <SelectTrigger>
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체 상태</SelectItem>
            <SelectItem value={LOG_STATUS.PENDING}>{LOG_STATUS_META[LOG_STATUS.PENDING].label}</SelectItem>
            <SelectItem value={LOG_STATUS.APPROVED}>{LOG_STATUS_META[LOG_STATUS.APPROVED].label}</SelectItem>
            <SelectItem value={LOG_STATUS.REJECTED}>{LOG_STATUS_META[LOG_STATUS.REJECTED].label}</SelectItem>
          </SelectContent>
        </Select>

        <Select items={managerItems} value={managerFilter} onValueChange={(v) => setManagerFilter(v as string)}>
          <SelectTrigger>
            <SelectValue placeholder="매니저" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체 매니저</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-rose-700">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && logs === null && (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <span className="mr-2 size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          불러오는 중...
        </div>
      )}

      {!error && logs !== null && visibleLogs.length === 0 && (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-24 text-sm text-muted-foreground">
          표시할 일지가 없습니다
        </div>
      )}

      {!error && logs !== null && visibleLogs.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">{visibleLogs.length}건</p>
          <div className="flex flex-col gap-3">
            {visibleLogs.map((log) => (
              <LogCard
                key={log.id}
                log={log}
                pending={pendingActionId === log.id}
                onApprove={() => handleApprove(log)}
                onReject={() => setRejectTarget(log)}
              />
            ))}
          </div>
        </>
      )}

      <RejectDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null)
        }}
        title="일지 반려"
        description={
          rejectTarget
            ? `${rejectTarget.recipientName} · ${rejectTarget.activityDate} 일지를 반려합니다. 사유는 필수입니다.`
            : ""
        }
        submitting={rejectSubmitting}
        onConfirm={handleRejectConfirm}
      />
    </div>
  )
}

function LogCard({
  log,
  pending,
  onApprove,
  onReject,
}: {
  log: ActivityLogCard
  pending: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const meta = LOG_STATUS_META[log.status]
  const recipientMeta = RECIPIENT_TYPE_META[log.recipientType]

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{log.recipientName}</span>
            <Badge variant="outline" className="text-xs">
              {recipientMeta.label}
            </Badge>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">{log.managerName}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {log.activityDate} {log.startedAt.slice(11, 16)}~{log.endedAt.slice(11, 16)} ·{" "}
            {ACTIVITY_TYPE_LABEL[log.activityType]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {log.isManual && (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              GPS 없음 · 수동완료
            </Badge>
          )}
          <StatusBadge {...meta} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <Row label="활동 장소">{log.place}</Row>
        <Row label="참여 인원">{log.participantCount}명</Row>
        <Row label="활동 내용">{log.content}</Row>
        <Row label="특이사항">{log.note ?? "-"}</Row>
        <Row label="첨부 사진">
          {log.photos.length === 0 ? (
            "없음"
          ) : (
            <span className="flex items-center gap-1.5">
              {log.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.id}
                  src={p.url}
                  alt="활동 사진"
                  className="size-10 rounded-md object-cover"
                />
              ))}
            </span>
          )}
        </Row>
        <Row label="GPS 정보">
          {log.isManual || !log.gpsStart || !log.gpsEnd
            ? "GPS 기록 없음 (수동 완료 처리)"
            : `거리 ${log.gpsDistance ?? 0}m · 시작 (${log.gpsStart.lat.toFixed(4)}, ${log.gpsStart.lng.toFixed(4)})`}
        </Row>

        {log.status === LOG_STATUS.REJECTED && log.rejectReason && (
          <p className="mt-1 rounded-md bg-rose-50 px-3 py-2 text-rose-700">
            반려 사유: {log.rejectReason}
          </p>
        )}
      </CardContent>
      {log.status === LOG_STATUS.PENDING && (
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" size="sm" disabled={pending} onClick={onReject}>
            반려
          </Button>
          <Button size="sm" disabled={pending} onClick={onApprove}>
            승인
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  )
}
