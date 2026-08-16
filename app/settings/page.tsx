"use client"

import { useEffect, useState } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { db } from "@/lib/data"
import { formatWon } from "@/lib/calc"
import type { Settings } from "@/lib/types"

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [unitPriceInput, setUnitPriceInput] = useState("")
  const [totalBudgetInput, setTotalBudgetInput] = useState("")
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState("")

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function fetchSettings() {
    setError(null)
    setSettings(null)
    db.getSettings()
      .then((s) => {
        setSettings(s)
        setUnitPriceInput(String(s.unitPrice))
        setTotalBudgetInput(String(s.totalBudget))
        setMonthlyBudgetInput(String(s.monthlyBudget))
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "설정을 불러오지 못했습니다"),
      )
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 진입 시 설정 불러오기
    fetchSettings()
  }, [])

  const unitPrice = Number(unitPriceInput)
  const totalBudget = Number(totalBudgetInput)
  const monthlyBudget = Number(monthlyBudgetInput)

  // 🟦 기획서 2-3: 단가는 0보다 커야 함
  const unitPriceInvalid = !Number.isFinite(unitPrice) || unitPrice <= 0
  const budgetInvalid =
    !Number.isFinite(totalBudget) || totalBudget < 0 || !Number.isFinite(monthlyBudget) || monthlyBudget < 0
  const formInvalid = unitPriceInvalid || budgetInvalid

  const unitPriceChanged = settings !== null && unitPrice !== settings.unitPrice

  function requestSave() {
    setSaveError(null)
    setSaved(false)
    if (formInvalid) return
    // 되돌릴 수 없는 액션(단가 변경)은 확인 다이얼로그를 거친다
    if (unitPriceChanged) {
      setConfirmOpen(true)
      return
    }
    void doSave()
  }

  async function doSave() {
    setSaving(true)
    setSaveError(null)
    try {
      await db.updateSettings({ unitPrice, totalBudget, monthlyBudget })
      fetchSettings()
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "설정을 저장하지 못했습니다")
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">설정</h1>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-rose-700">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchSettings}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && settings === null && (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <span className="mr-2 size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          불러오는 중...
        </div>
      )}

      {!error && settings !== null && (
        <Card className="max-w-md">
          <CardContent className="flex flex-col gap-5">
            <Field
              label="활동 1회 기준 단가"
              suffix="원"
              value={unitPriceInput}
              onChange={setUnitPriceInput}
              invalid={unitPriceInvalid}
              helpText={unitPriceInvalid ? "단가는 0보다 커야 합니다" : undefined}
            />
            <Field
              label="사업 전체 예산"
              suffix="원"
              value={totalBudgetInput}
              onChange={setTotalBudgetInput}
              helpText="0 = 미설정"
            />
            <Field
              label="이번 달 배정 예산"
              suffix="원"
              value={monthlyBudgetInput}
              onChange={setMonthlyBudgetInput}
              helpText="0 = 미설정. 대시보드/설정 안내 배너가 노출됩니다"
            />

            {saveError && <p className="text-sm text-rose-700">{saveError}</p>}
            {saved && <p className="text-sm text-emerald-700">저장되었습니다</p>}

            <div className="flex items-center gap-2">
              <Button disabled={formInvalid || saving} onClick={requestSave}>
                설정 저장
              </Button>
              {settings.totalBudget > 0 && (
                <span className="text-xs text-muted-foreground">
                  전체 예산 {formatWon(settings.totalBudget)} 기준
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="단가를 변경할까요?"
        description={`단가가 ${settings ? formatWon(settings.unitPrice) : ""} → ${Number.isFinite(unitPrice) ? formatWon(unitPrice) : "-"}(으)로 바뀝니다. 아직 승인되지 않은 정산의 산정액이 전부 새 단가로 다시 계산됩니다. 이미 승인된 정산은 영향받지 않습니다.`}
        confirmLabel="변경 저장"
        submitting={saving}
        onConfirm={doSave}
      />
    </div>
  )
}

function Field({
  label,
  suffix,
  value,
  onChange,
  invalid,
  helpText,
}: {
  label: string
  suffix: string
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  helpText?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          className="max-w-48"
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
      {helpText && (
        <p className={invalid ? "text-xs text-rose-600" : "text-xs text-muted-foreground"}>{helpText}</p>
      )}
    </div>
  )
}
