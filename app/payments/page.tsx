"use client"

import { useEffect, useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { RejectDialog } from "@/components/reject-dialog"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { formatWon, sumSettlements } from "@/lib/calc"
import { db } from "@/lib/data"
import { PAYOUT_STATUS, SETTLEMENT_STATUS, SETTLEMENT_STATUS_META } from "@/lib/status"
import type { PayoutRow, SettlementRow, YearMonth } from "@/lib/types"
import { lastNMonths } from "@/lib/utils"

const MONTH_COUNT = 6

export default function PaymentsPage() {
  const months = useMemo(() => lastNMonths(MONTH_COUNT), [])
  const [selectedMonth, setSelectedMonth] = useState<YearMonth>(months[months.length - 1])

  const [settlements, setSettlements] = useState<SettlementRow[] | null>(null)
  const [settlementsError, setSettlementsError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [settlementActionId, setSettlementActionId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<SettlementRow | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  const [payouts, setPayouts] = useState<PayoutRow[] | null>(null)
  const [payoutsError, setPayoutsError] = useState<string | null>(null)
  const [payTarget, setPayTarget] = useState<PayoutRow | null>(null)
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<PayoutRow | null>(null)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  function fetchSettlements(month: YearMonth) {
    setSettlementsError(null)
    setSettlements(null)
    db.listSettlements(month)
      .then(setSettlements)
      .catch((err: unknown) =>
        setSettlementsError(err instanceof Error ? err.message : "정산 목록을 불러오지 못했습니다"),
      )
  }

  function fetchPayouts() {
    setPayoutsError(null)
    setPayouts(null)
    db.listPayouts(PAYOUT_STATUS.REQUESTED)
      .then(setPayouts)
      .catch((err: unknown) =>
        setPayoutsError(err instanceof Error ? err.message : "출금 신청 목록을 불러오지 못했습니다"),
      )
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 월 변경 시 정산 목록 재조회
    fetchSettlements(selectedMonth)
  }, [selectedMonth])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 진입 시 출금 신청 목록 조회
    fetchPayouts()
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setSettlementsError(null)
    try {
      await db.generateSettlements(selectedMonth)
      fetchSettlements(selectedMonth)
    } catch (err) {
      setSettlementsError(err instanceof Error ? err.message : "정산 생성에 실패했습니다")
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove(row: SettlementRow) {
    setSettlementActionId(row.id)
    try {
      await db.approveSettlement(row.id)
      fetchSettlements(selectedMonth)
    } catch (err) {
      setSettlementsError(err instanceof Error ? err.message : "정산 승인에 실패했습니다")
    } finally {
      setSettlementActionId(null)
    }
  }

  async function handleCancelConfirm() {
    if (!cancelTarget) return
    setCancelSubmitting(true)
    try {
      await db.cancelSettlementApproval(cancelTarget.id)
      setCancelTarget(null)
      fetchSettlements(selectedMonth)
    } catch (err) {
      setSettlementsError(err instanceof Error ? err.message : "승인 취소에 실패했습니다")
    } finally {
      setCancelSubmitting(false)
    }
  }

  async function handlePayConfirm() {
    if (!payTarget) return
    setPaySubmitting(true)
    try {
      await db.markPayoutPaid(payTarget.id)
      setPayTarget(null)
      fetchPayouts()
    } catch (err) {
      setPayoutsError(err instanceof Error ? err.message : "지급 처리에 실패했습니다")
    } finally {
      setPaySubmitting(false)
    }
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectTarget) return
    setRejectSubmitting(true)
    try {
      await db.rejectPayout(rejectTarget.id, reason)
      setRejectTarget(null)
      fetchPayouts()
    } catch (err) {
      setPayoutsError(err instanceof Error ? err.message : "반려 처리에 실패했습니다")
    } finally {
      setRejectSubmitting(false)
    }
  }

  const settlementTotal = useMemo(
    () => (settlements ? sumSettlements(settlements) : 0),
    [settlements],
  )
  const managerCount = useMemo(
    () => (settlements ? new Set(settlements.map((s) => s.managerId)).size : 0),
    [settlements],
  )
  const pendingPayoutCount = payouts?.length ?? 0

  const monthItems = useMemo(
    () => Object.fromEntries(months.map((m) => [m, m])),
    [months],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">활동비 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            일지 승인과 정산 승인은 별개입니다. 정산 승인 시점에 매니저 잔액이 적립됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            items={monthItems}
            value={selectedMonth}
            onValueChange={(v) => setSelectedMonth(v as YearMonth)}
          >
            <SelectTrigger>
              <SelectValue placeholder="월" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={generating} onClick={handleGenerate}>
            {generating ? "생성 중..." : "월별 정산 생성(재산정)"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="해당 월 산정 총액" value={settlements ? formatWon(settlementTotal) : "-"} />
        <SummaryCard label="대상 매니저 수" value={settlements ? `${managerCount}명` : "-"} />
        <SummaryCard
          label="출금 신청 대기 건수"
          value={payouts ? `${pendingPayoutCount}건` : "-"}
          highlight={pendingPayoutCount > 0}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">출금 신청 처리</h2>

        {payoutsError && <ErrorBanner message={payoutsError} onRetry={fetchPayouts} />}

        {!payoutsError && payouts === null && <LoadingRow />}

        {!payoutsError && payouts !== null && payouts.length === 0 && (
          <EmptyRow text="처리할 출금 신청이 없습니다" />
        )}

        {!payoutsError && payouts !== null && payouts.length > 0 && (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>매니저</TableHead>
                    <TableHead>신청 금액</TableHead>
                    <TableHead>신청일</TableHead>
                    <TableHead className="text-right">처리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.managerName}</TableCell>
                      <TableCell className="tabular-nums">{formatWon(p.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.createdAt.slice(0, 10)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setRejectTarget(p)}>
                            반려
                          </Button>
                          <Button size="sm" onClick={() => setPayTarget(p)}>
                            지급 완료
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">월별 정산 — {selectedMonth}</h2>

        {settlementsError && <ErrorBanner message={settlementsError} onRetry={() => fetchSettlements(selectedMonth)} />}

        {!settlementsError && settlements === null && <LoadingRow />}

        {!settlementsError && settlements !== null && settlements.length === 0 && (
          <EmptyRow text="이 달에 산정된 정산이 없습니다. [월별 정산 생성]을 눌러 만드세요" />
        )}

        {!settlementsError && settlements !== null && settlements.length > 0 && (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>매니저</TableHead>
                    <TableHead>활동 건수</TableHead>
                    <TableHead>단가</TableHead>
                    <TableHead>산정액</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">처리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.managerName}</TableCell>
                      <TableCell className="tabular-nums">{s.logCount}건</TableCell>
                      <TableCell className="tabular-nums">{formatWon(s.unitPrice)}</TableCell>
                      <TableCell className="tabular-nums font-medium">{formatWon(s.amount)}</TableCell>
                      <TableCell>
                        <StatusBadge {...SETTLEMENT_STATUS_META[s.status]} />
                      </TableCell>
                      <TableCell className="text-right">
                        {s.status === SETTLEMENT_STATUS.CALCULATED ? (
                          <Button
                            size="sm"
                            disabled={settlementActionId === s.id}
                            onClick={() => handleApprove(s)}
                          >
                            승인
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setCancelTarget(s)}>
                            승인 취소
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="정산 승인을 취소할까요?"
        description={
          cancelTarget
            ? `${cancelTarget.managerName}의 ${cancelTarget.yearMonth} 정산(${formatWon(cancelTarget.amount)}) 승인을 취소합니다. 취소로 잔액이 음수가 되면 서버가 거부합니다.`
            : ""
        }
        confirmLabel="승인 취소"
        destructive
        submitting={cancelSubmitting}
        onConfirm={handleCancelConfirm}
      />

      <ConfirmDialog
        open={payTarget !== null}
        onOpenChange={(open) => !open && setPayTarget(null)}
        title="지급 완료로 처리할까요?"
        description={
          payTarget ? `${payTarget.managerName}에게 ${formatWon(payTarget.amount)}을 지급 완료 처리합니다.` : ""
        }
        confirmLabel="지급 완료"
        submitting={paySubmitting}
        onConfirm={handlePayConfirm}
      />

      <RejectDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="출금 신청 반려"
        description={
          rejectTarget
            ? `${rejectTarget.managerName}의 ${formatWon(rejectTarget.amount)} 출금 신청을 반려합니다. 반려 금액은 잔액으로 복귀합니다.`
            : ""
        }
        submitting={rejectSubmitting}
        onConfirm={handleRejectConfirm}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={highlight ? "text-2xl font-bold tabular-nums text-amber-600" : "text-2xl font-bold tabular-nums"}>
          {value}
        </span>
      </CardContent>
    </Card>
  )
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
      <span className="mr-2 size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      불러오는 중...
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-16 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-rose-200 bg-rose-50">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <p className="text-sm text-rose-700">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      </CardContent>
    </Card>
  )
}
